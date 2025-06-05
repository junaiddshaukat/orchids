import requests
import functools
import shutil
import codecs
import sys
import os
import logging
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
from typing import List, Optional

logger = logging.getLogger(__name__)

class WebsiteCloner:
    def __init__(self, url: str, output_dir: str, use_tor_network: bool = False):
        self.url = url
        self.output_dir = output_dir
        self.output_folder = urlparse(url).netloc
        self.full_output_path = os.path.join(output_dir, self.output_folder)
        
        # initialize a session
        self.session = requests.session()
        if use_tor_network:
            self.session.request = functools.partial(self.session.request, timeout=30)
            self.session.proxies = {'http':  'socks5h://localhost:9050',
                                  'https': 'socks5h://localhost:9050'}
        
        # Get initial page content
        self.soup = BeautifulSoup(self.get_page_content(url), "html.parser")
        self.scraped_urls = self.scrap_all_urls()

    def get_page_content(self, url: str) -> Optional[str]:
        try: 
            content = self.session.get(url)
            content.encoding = 'utf-8'
            return content.text
        except Exception as e:
            logger.error(f"Failed to get page content for {url}: {str(e)}")
            return None

    def scrap_scripts(self) -> List[str]:
        script_urls = []
        for script_tag in self.soup.find_all("script"):
            script_url = script_tag.attrs.get("src")
            if script_url:
                if not script_url.startswith('http'): 
                    script_url = urljoin(self.url, script_url)
                else: 
                    continue

                new_url = self.url_to_local_path(script_url, keepQuery=True)
                if new_url:
                    script_tag['src'] = new_url
                    script_urls.append(script_url.split('?')[0])
        
        return list(dict.fromkeys(script_urls))

    def scrap_form_attr(self) -> List[str]:
        urls = []
        for form_tag in self.soup.find_all("form"):
            form_url = form_tag.attrs.get("action")
            if form_url:
                if not form_url.startswith('http'): 
                    form_url = urljoin(self.url, form_tag.attrs.get("action"))

                new_url = self.url_to_local_path(form_url, keepQuery=True)
                if new_url:
                    form_tag['action'] = new_url
                    urls.append(form_url.split('?')[0])

        return list(dict.fromkeys(urls))

    def scrap_a_attr(self) -> List[str]:
        urls = []
        for link_tag in self.soup.find_all('a'):
            link_url = link_tag.attrs.get('href')
            if link_url:
                if not link_url.startswith('http'): 
                    link_url = urljoin(self.url, link_tag.attrs.get('href'))

                new_url = self.url_to_local_path(link_url, keepQuery=True)
                if new_url:
                    link_tag['href'] = new_url
                    urls.append(link_url.split('?')[0])

        return list(dict.fromkeys(urls))

    def scrap_img_attr(self) -> List[str]:
        urls = []
        for img_tag in self.soup.find_all('img'):
            img_url = img_tag.attrs.get('src')
            if img_url:
                if not img_url.startswith('http'): 
                    img_url = urljoin(self.url, img_tag.attrs.get('src'))

                new_url = self.url_to_local_path(img_url, keepQuery=True)
                if new_url:
                    img_tag['src'] = new_url
                    urls.append(img_url.split('?')[0])

        return list(dict.fromkeys(urls))
    
    def scrap_link_attr(self) -> List[str]:
        urls = []
        for link_tag in self.soup.find_all('link'):
            link_url = link_tag.attrs.get('href')
            if link_url:
                if not link_url.startswith('http'): 
                    link_url = urljoin(self.url, link_tag.attrs.get('href'))

                new_url = self.url_to_local_path(link_url, keepQuery=True)
                if new_url:
                    link_tag['href'] = new_url
                    urls.append(link_url.split('?')[0])

        return list(dict.fromkeys(urls))
    
    def scrap_btn_attr(self) -> List[str]:
        urls = []
        for buttons in self.soup.find_all('button'):
            button_url = buttons.attrs.get('onclick')
            if not button_url: 
                continue

            button_url = button_url.replace(' ','')
            button_url = button_url[button_url.find('location.href='):].replace('location.href=','')
            button_url = button_url.replace('\'', '').replace('\"', '').replace('`', '')

            if button_url and button_url.startswith('/'):
                if not button_url.startswith('http'): 
                    button_url = urljoin(self.url, buttons.get('onclick'))

                new_url = self.url_to_local_path(button_url, keepQuery=True)
                if new_url:
                    buttons['onclick'] = new_url
                    urls.append(button_url.split('?')[0])

        return list(dict.fromkeys(urls))

    def scrap_assets(self) -> List[str]:
        assets_urls = []
        
        for attr_scraper in [
            self.scrap_form_attr,
            self.scrap_a_attr,
            self.scrap_img_attr,
            self.scrap_link_attr,
            self.scrap_btn_attr
        ]:
            attr_urls = attr_scraper()
            if attr_urls:
                assets_urls = list(set(assets_urls + attr_urls))

        return assets_urls

    def scrap_all_urls(self) -> List[str]:
        urls = []
        urls.extend(self.scrap_scripts())
        urls.extend(self.scrap_assets())
        return list(dict.fromkeys(urls))
    
    def url_to_local_path(self, url: str, keepQuery: bool = False) -> Optional[str]:
        try:
            new_url = urlparse(url).path
            query = urlparse(url).query
            if keepQuery and query: 
                new_url += '?' + urlparse(url).query
            if (new_url[0] == '/') or (new_url[0] == '\\'): 
                new_url = new_url[1:]
        except:
            return None

        return new_url

    def download_file(self, url: str, output_path: str) -> bool:
        try:
            # Remove query string and http from URL
            url = url.split('?')[0]
            file_name = url.split('/')[-1]

            if len(file_name) == 0: 
                return False

            # Create output directory
            os.makedirs(os.path.dirname(output_path), exist_ok=True)

            # Get file content and save it
            response = self.session.get(url)
            with open(output_path, "wb") as file:
                file.write(response.content)
                logger.info(f"Downloaded {file_name} to {os.path.relpath(output_path)}")
            
            return True
        except Exception as e:
            logger.error(f"Failed to download file {url}: {str(e)}")
            return False
    
    def save_files(self, urls: List[str]) -> bool:
        try:
            shutil.rmtree(self.full_output_path, ignore_errors=True)
            for url in urls:
                output_path = self.url_to_local_path(url, keepQuery=False)
                if output_path:
                    output_path = os.path.join(self.full_output_path, output_path)
                    self.download_file(url, output_path)
            return True
        except Exception as e:
            logger.error(f"Failed to save files: {str(e)}")
            return False
    
    def save_html(self) -> bool:
        try:
            output_path = os.path.join(self.full_output_path, 'index.html')
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            
            prettyHTML = self.soup.prettify()
            with codecs.open(output_path, 'w', 'utf-8') as file:
                file.write(prettyHTML)
                logger.info(f"Saved index.html to {os.path.relpath(output_path)}")
            
            return True
        except Exception as e:
            logger.error(f"Failed to save HTML: {str(e)}")
            return False

    def clone(self) -> dict:
        """
        Main method to clone the website.
        Returns a dictionary with the cloning results.
        """
        try:
            logger.info(f"Starting to clone website: {self.url}")
            
            # Save all assets
            files_saved = self.save_files(self.scraped_urls)
            
            # Save the main HTML file
            html_saved = self.save_html()
            
            return {
                "success": files_saved and html_saved,
                "url": self.url,
                "output_folder": self.full_output_path,
                "files_count": len(self.scraped_urls),
                "files": self.scraped_urls
            }
        except Exception as e:
            logger.error(f"Failed to clone website: {str(e)}")
            return {
                "success": False,
                "url": self.url,
                "error": str(e)
            } 