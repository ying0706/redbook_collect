// background.js
// 负责中转飞书API请求，解决CORS问题

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'feishu_api') {
    fetch(request.url, {
      method: request.method || 'GET',
      headers: request.headers || {},
      body: request.body ? JSON.stringify(request.body) : undefined,
    })
      .then(async res => {
        const data = await res.json();
        console.log('飞书API返回：', data); // 调试输出
        sendResponse({ success: true, data });
      })
      .catch(err => {
        sendResponse({ success: false, error: err.message });
      });
    // 必须返回true以支持异步sendResponse
    return true;
  }
}); 