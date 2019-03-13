const http = require('http');
const path = require('path');
const config = require('./config/default');
const fs = require('fs');
const mime = require('./mime');
const crypto = require("crypto")
const url  = require('url');


// 定义Expires规则
const Expires = {
  fileMatch: /(gif|png|jpg|jpeg|js|css)$/ig,
  maxAge: 60
};
const hasTrailingSlash = url => url[url.length - 1] === '/';

class StaticServer {
    constructor() {
        this.port = config.port;
        this.root = config.root;
        this.indexPage = config.indexPage;
    }

    respondFile(pathName, req, res){
      const extname = path.extname(req.url);
      fs.readFile(pathName, 'binary', (err, file)=>{
        if(err) {
          // 文件读取出错
          res.writeHead(500, {"Content-Type": "text/plain"})
          res.end(err)
          return
        }else{
          // Expires 和 Cache-Control 缓存
          if( extname.match(Expires.fileMatch) ){
            let expires = new Date();
            expires.setTime(expires.getTime() + Expires.maxAge * 1000);
            res.setHeader("Expires", expires.toUTCString());
            res.setHeader("Cache-Control", "max-age=" + Expires.maxAge);
          }

          // Last-Modified / If-Modified-Since缓存
          let stat = fs.statSync(pathName)
          let lastModified = stat.mtime.toUTCString()
          res.setHeader("Last-Modified", lastModified)
          if (req.headers["if-modified-since"] && lastModified == req.headers["if-modified-since"]) {
            res.writeHead(304, "Not Modified",  {"Content-Type": mime.lookup(pathName) });
            res.end();
            return;
          }

          // Etag  Last-Modified 作为 hash 缓存
          let hashStr = fs.statSync(pathName).mtime.toUTCString()
          let hash = crypto.createHash('sha1').update(hashStr).digest('base64')
          if(req.headers['if-none-match'] == hash){
              res.writeHead(304, "Not Modified",  {"Content-Type": mime.lookup(pathName) });
              res.end();
              return;
          }
          res.setHeader("Etag", hash);

          // 正常写文件
          res.writeHead(200, {"Content-Type": mime.lookup(pathName) });
          console.log('写文件'+req.url);
          res.write(file, "binary")
          res.end()
          return
        }
      })
    }

    respondDirectory( pathName, req, res ){
      const indexPagePath = path.join(pathName, this.indexPage);
      if (fs.existsSync(indexPagePath)) {
          this.respondFile(indexPagePath, req, res);
      } else {
          fs.readdir(pathName, (err, files) => {
              if (err) {
                  res.writeHead(500);
                  return res.end(err);
              }
              const requestPath = url.parse(req.url).pathname;
              let content = `<h1>Index of ${requestPath}</h1>`;
              files.forEach(file => {
                  let itemLink = path.join(requestPath,file);
                  const stat = fs.statSync(path.join(pathName, file));
                  if (stat && stat.isDirectory()) {
                      itemLink = path.join(itemLink, '/');
                  }                 
                  content += `<p><a href='${itemLink}'>${file}</a></p>`;
              });
              res.writeHead(200, {
                  'Content-Type': 'text/html'
              });
              res.end(content);
          });
      }
    }

    respondRedirect( req, res ){
      const location = req.url + '/';
      res.writeHead(301, {
          'Location': location,
          'Content-Type': 'text/html'
      });
      res.end(`Redirecting to <a href='${location}'>${location}</a>`);
    }

    respondNotFound(req, res) {
      res.writeHead(404, {
          'Content-Type': 'text/html'
      });
      res.end(`<h1>Not Found</h1><p>The requested URL ${req.url} was not found on this server.</p>`);
    }

    routeHandler(pathName, req, res){
      fs.stat(pathName, (err, stat) => {
        if (!err) {
          const reqPath = url.parse(req.url).pathname;
          if(hasTrailingSlash(reqPath) && stat.isDirectory() ){
            this.respondDirectory(pathName, req, res);
          }else if( stat.isDirectory() ){
            this.respondRedirect(req, res);
          }else{
            this.respondFile(pathName, req, res);
          }
          
        } else {
          this.respondNotFound(req, res);
        }
      });
    }

    start() {
        http.createServer((req, res) => {
            console.log(req.url);
            const pathName = path.join(this.root, path.normalize(req.url));
            this.routeHandler(pathName, req, res);
        }).listen(this.port, err => {
            if (err) {
                console.error(err);
                console.info('Failed to start server');
            } else {
                console.info(`Server started on port ${this.port}`);
            }
        });
    }
}

module.exports = StaticServer;