// options.js
// 用于独立标签页填写和保存飞书配置信息

document.addEventListener('DOMContentLoaded', function() {
  const tableUrlInput = document.getElementById('tableUrl');
  const appIdInput = document.getElementById('appId');
  const appSecretInput = document.getElementById('appSecret');
  const saveConfigButton = document.getElementById('saveConfig');
  const statusDiv = document.getElementById('status');

  // 加载已保存的配置
  chrome.storage.local.get(['tableUrl', 'appId', 'appSecret'], function(result) {
    if (result.tableUrl) tableUrlInput.value = result.tableUrl;
    if (result.appId) appIdInput.value = result.appId;
    if (result.appSecret) appSecretInput.value = result.appSecret;
  });

  // 保存配置
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
      statusDiv.textContent = '配置已保存！可以关闭本页返回插件继续使用';
      setTimeout(() => {
        statusDiv.textContent = '';
      }, 3000);
    });
  });
}); 