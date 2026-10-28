// noinspection JSUnusedGlobalSymbols

import { defineConfig } from "vitepress";
import { existsSync, readdirSync, readFileSync, statSync, utimesSync } from "fs";
import { fileURLToPath } from "url";
import { basename, extname, isAbsolute, join, relative, resolve, sep } from "path";
import wikilinks from "markdown-it-wikilinks";
import abbr from "markdown-it-abbr";

const srcDir = fileURLToPath(new URL('../src/pages', import.meta.url));

const configFile = fileURLToPath(new URL('./config.ts', import.meta.url));

type SidebarItem = {
  text: string
  link?: string
  collapsed?: boolean
  sitems?: SidebarItem[]
}

function humanize(name: string): string {
  return name.replace(/[-_]/g, ' ').replace(/\b[a-z]/g, letter => letter.toUpperCase());
}

function getPageTitle(filePath: string, fallback: string): string {
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    return fallback;
  }
  
  const content = readFileSync(filePath, 'utf8');
  
  const frontmatter = content.match(/^---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];

  const titleMatch = frontmatter?.match(/^\s*title:\s*(?:"([^"]+)"|'([^']+)'|([^#\r\n]+?))\s*$/m);
  
  const title = titleMatch?.[1] ?? titleMatch?.[2] ?? titleMatch?.[3]?.trim();
  
  const heading = content.match(/^#\s+(.+?)\s*#*\s*$/m)?.[1]?.trim();
  
  return title || heading || fallback;
}

function loadPages(dir: string = srcDir, prefix: string = ''): SidebarItem[] {
  const entries = readdirSync(dir, { withFileTypes: true }).filter(entry => !entry.name.startsWith('.'));
  
  const files = entries.filter(entry => entry.isFile()).sort((a, b) => {
    if (a.name.toLowerCase() === 'index.md') return -1;
    if (b.name.toLowerCase() === 'index.md') return 1;
    
    return a.name.localeCompare(b.name);
  });
  
  const directories = entries.filter(entry => entry.isDirectory()).sort((a, b) => a.name.localeCompare(b.name));
  
  const pages: SidebarItem[] = files.map(file => {
    const name = basename(file.name, extname(file.name));
    const isIndex = name.toLowerCase() === 'index';
    
      
    return {
      text: isIndex ? 'Start' : getPageTitle(join(dir, file.name), humanize(name)),
      link: isIndex ? '.' : name
    };
  });
  
  const groups: SidebarItem[] = directories.flatMap(directory => {
    const folderPrefix = `${directory.name}/`;
    
    const children = loadPages(join(dir, directory.name), folderPrefix);
    
    if (children.length === 0) return [];
    
    return [{
      text: humanize(directory.name),
      collapsed: true,
      items: children
    }];
  });
  
  return [...pages, ...groups];
}

export default defineConfig({
  title: "CHANGE_ME",
  description: "CHANGE_ME",

  cleanUrls: true,
  
  srcDir: "src",
  srcExclude: ["**/README.md"],

  head: [["link", { rel: "icon", href: "/assets/logo.png" }]],

  themeConfig: {
    logo: {
      src: "/assets/logo.png",
      width: 24,
      height: 24
    },

    sidebar: {
      '/': { base: '/', items: loadPages() }
    }
  },
  
  rewrites: {
    "pages/:slug*": ":slug*"
  },
  
  markdown: {
    config: (md) => {
      md.use(
        wikilinks({
          uriSuffix: '',
          generatePagePathFromLabel: (label: string) => {
            return label.toLowerCase().trim().replace('/\s+g', '-')
          }
        })
      ),
      md.use(abbr)
    }
  },
  
  vite: {
    plugins: [
      {
        name: 'watch-src',
        
        configureServer(server) {
          server.watcher.add(srcDir);
          
          let timer: ReturnType<typeof setTimeout> | undefined;
          
          server.watcher.on('all', (event, changed) => {
            if (!['add', 'unlink'].includes(event)) return;
            
            const changedPath = resolve(changed);
            const rel = relative(srcDir, changedPath)
            
            if (!rel || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) return;
            
            clearTimeout(timer);
            
            timer = setTimeout(() => {
              const now = new Date();
              
              utimesSync(configFile, now, now);
            }, 50);
            
          });
        }
      }
    ]
  }
});
