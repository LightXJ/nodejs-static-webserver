const path = require('path');

const mimeTypes = {
    "css": "text/css",
    "gif": "image/gif",
    "html": "text/html",
    "ico": "image/x-icon",
    "jpeg": "image/jpeg",
    "json": "application/json",
    'pdf': "application/pdf"
};

const lookup = (pathName) => {
    let ext = path.extname(pathName);
    ext = ext.split('.').pop();
    return mimeTypes[ext] || mimeTypes['txt'];
}

module.exports = {
    lookup
};