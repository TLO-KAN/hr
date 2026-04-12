export const urlRewriter = (req, res, next) => {
  if (req.url.startsWith('/api/v1/api/')) {
    req.url = req.url.replace('/api/v1/api/', '/api/');
  } else if (req.url === '/api/v1/api') {
    req.url = '/api';
  } else if (req.url.startsWith('/api/v1/')) {
    req.url = req.url.replace('/api/v1/', '/api/');
  } else if (req.url === '/api/v1') {
    req.url = '/api';
  }
  next();
};