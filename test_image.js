const http = require('http');

http.get('http://localhost:5000/uploads/temp-photo-1782724576495-954164891.png', (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
  res.on('data', () => {}); // consume data
}).on('error', (e) => {
  console.error(`Got error: ${e.message}`);
});
