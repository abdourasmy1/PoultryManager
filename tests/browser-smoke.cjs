const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
(async()=>{
 const server=http.createServer((req,res)=>{
  let file=path.join(process.cwd(),'dist',decodeURIComponent(req.url.split('?')[0]));
  if(!fs.existsSync(file)||fs.statSync(file).isDirectory())file=path.join(process.cwd(),'dist/index.html');
  res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.wasm':'application/wasm','.svg':'image/svg+xml','.ttf':'font/ttf','.png':'image/png'}[path.extname(file)])||'application/octet-stream');
  res.end(fs.readFileSync(file));
 });
 await new Promise(r=>server.listen(8773,r));let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:'/opt/ms-playwright/chromium-1234/chrome-linux64/chrome',args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1440,height:1100}});
  const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',e.message);});page.on('console',m=>{if(m.type()==='error')console.log('CONSOLE',m.text());});
  await page.goto('http://localhost:8773');await page.waitForTimeout(3000);
  await page.screenshot({path:'/tmp/dashboard-desktop.png',fullPage:true});
  console.log((await page.locator('body').innerText()).slice(0,3200));
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(600);await page.screenshot({path:'/tmp/dashboard-mobile.png',fullPage:true});
  if(errors.length)throw Error(errors.join('\n'));
  console.log('PASS: desktop and mobile render without uncaught browser errors');
 } finally {await browser?.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
