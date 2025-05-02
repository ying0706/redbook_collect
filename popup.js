// 页面加载完成后执行
document.addEventListener('DOMContentLoaded', function() {
  // 获取DOM元素
  const tableUrlInput = document.getElementById('tableUrl');
  const appIdInput = document.getElementById('appId');
  const appSecretInput = document.getElementById('appSecret');
  const saveConfigButton = document.getElementById('saveConfig');
  const collectDataButton = document.getElementById('collectData');
  const statusDiv = document.getElementById('status');

  // 加载保存的配置
  chrome.storage.local.get(['tableUrl', 'appId', 'appSecret'], function(result) {
    if (!result.tableUrl || !result.appId || !result.appSecret) {
      // 配置信息缺失，打开独立标签页
      chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
      window.close(); // 关闭弹窗
      return;
    }
    if (result.tableUrl) tableUrlInput.value = result.tableUrl;
    if (result.appId) appIdInput.value = result.appId;
    if (result.appSecret) appSecretInput.value = result.appSecret;
  });

  // 保存配置按钮点击事件
  saveConfigButton.addEventListener('click', function() {
    const tableUrl = tableUrlInput.value.trim();
    const appId = appIdInput.value.trim();
    const appSecret = appSecretInput.value.trim();

    if (!tableUrl || !appId || !appSecret) {
      statusDiv.textContent = '请填写所有配置信息';
      return;
    }

    chrome.storage.local.set({
      tableUrl: tableUrl,
      appId: appId,
      appSecret: appSecret
    }, function() {
      statusDiv.textContent = '配置已保存';
      setTimeout(() => {
        statusDiv.textContent = '';
      }, 2000);
    });
  });

  // 提取内容按钮点击事件
  collectDataButton.addEventListener('click', function() {
    // 检查是否已保存配置
    chrome.storage.local.get(['tableUrl', 'appId', 'appSecret'], function(result) {
      if (!result.tableUrl || !result.appId || !result.appSecret) {
        statusDiv.textContent = '请先保存配置信息';
        return;
      }

      // 获取当前标签页
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        const currentTab = tabs[0];
        
        // 检查是否在小红书笔记页面
        if (!currentTab.url.includes('xiaohongshu.com')) {
          statusDiv.textContent = '请先打开一篇小红书笔记';
          return;
        }

        // 执行内容脚本
        chrome.scripting.executeScript({
          target: {tabId: currentTab.id},
          function: extractNoteData
        }, function(results) {
          if (results && results[0] && results[0].result) {
            const noteData = results[0].result;
            // 调用飞书API写入数据
            writeToFeishu(noteData, result);
          } else {
            statusDiv.textContent = '无法提取笔记内容，请确保在笔记详情页';
          }
        });
      });
    });
  });
});

// 提取笔记数据的函数
function extractNoteData() {
  const noteContainer = document.getElementById('noteContainer');
  if (!noteContainer) {
    return null;
  }

  const data = {
    URL: window.location.href,
    作者: document.querySelector('.username')?.textContent || '',
    标题: document.querySelector('.title')?.textContent || '',
    正文: document.querySelector('.note-text span')?.textContent || '',
    标签: Array.from(document.querySelectorAll('.note-text .tag')).map(tag => tag.textContent),
    点赞数: parseInt(document.querySelector('.like-wrapper .count')?.textContent || '0'),
    收藏数: parseInt(document.querySelector('.collect-wrapper .count')?.textContent || '0'),
    评论数: parseInt(document.querySelector('.chat-wrapper .count')?.textContent || '0')
  };

  return data;
}

// 写入飞书多维表格
async function writeToFeishu(noteData, config) {
  try {
    // 获取tenant_access_token
    const tokenRes = await sendFeishuApi({
      url: 'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        app_id: config.appId,
        app_secret: config.appSecret
      }
    });
    const tokenData = tokenRes.data;
    if (tokenData.code !== 0) {
      throw new Error('获取token失败');
    }
    // 从表格URL中提取app_token和table_id
    const urlMatch = config.tableUrl.match(/base\/([^?]+)\?table=([^&]+)/);
    if (!urlMatch) {
      throw new Error('无效的表格URL');
    }
    const [_, app_token, table_id] = urlMatch;
    // 写入数据
    const writeRes = await sendFeishuApi({
      url: `https://open.feishu.cn/open-apis/bitable/v1/apps/${app_token}/tables/${table_id}/records`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenData.tenant_access_token}`
      },
      body: { fields: noteData }
    });
    const writeData = writeRes.data;
    if (writeData.code !== 0) {
      throw new Error('写入数据失败');
    }
    document.getElementById('status').textContent = '数据已成功写入飞书表格';
  } catch (error) {
    document.getElementById('status').textContent = `错误: ${error.message}`;
  }
}

// 通过background.js中转API请求，解决CORS
function sendFeishuApi(params) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: 'feishu_api', ...params }, (response) => {
      if (response && response.success) {
        resolve(response);
      } else {
        reject(new Error(response?.error || 'API请求失败'));
      }
    });
  });
} 