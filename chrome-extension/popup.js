console.log("Popup script loaded!");

// 后端 API 基础 URL (从环境变量或默认值获取)
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000/api'; 

// 获取认证 Token 的函数 (需要根据实际存储方式实现)
async function getAuthToken() {
  // 示例：假设 token 存储在 chrome.storage.local
  return new Promise((resolve) => {
    chrome.storage.local.get(['authToken'], (result) => {
      resolve(result.authToken || null);
    });
  });
  // return 'YOUR_STATIC_TOKEN_FOR_TESTING'; // 或者返回一个静态 token 用于测试
}

// 更新 UI 显示状态的函数
function updateStatusUI(statusData) {
  const submissionStatusElement = document.getElementById('submission-status');
  const membershipPromoElement = document.getElementById('membership-promo');
  const upgradeLinkElement = document.getElementById('upgrade-link'); // 获取升级链接元素

  if (!submissionStatusElement || !membershipPromoElement || !upgradeLinkElement) {
    console.error('Required UI elements for status not found!');
    return;
  }

  if (statusData && typeof statusData.remainingSubmissions !== 'undefined' && typeof statusData.limit !== 'undefined') {
    submissionStatusElement.textContent = `今日剩余次数: ${statusData.remainingSubmissions} / ${statusData.limit}`;
    
    // 根据是否会员决定是否显示升级引导
    if (statusData.isMember) {
      membershipPromoElement.style.display = 'none'; // 会员不显示引导
    } else {
      membershipPromoElement.style.display = 'block'; // 非会员显示引导
      // 设置升级链接 (需要替换为实际的 SaaS 购买页面地址)
      upgradeLinkElement.href = 'https://your-saas-domain.com/pricing'; 
    }
  } else {
    submissionStatusElement.textContent = "加载状态失败，请稍后重试";
    membershipPromoElement.style.display = 'none';
  }
}

// 获取用户状态的函数
async function fetchUserStatus() {
  const submissionStatusElement = document.getElementById('submission-status');
  submissionStatusElement.textContent = "正在加载状态..."; // 设置初始加载提示

  const token = await getAuthToken();
  if (!token) {
    console.error('No auth token found. Cannot fetch user status.');
    updateStatusUI(null); // 显示加载失败
    // 可以引导用户登录
    const statusMessage = document.getElementById('status-message');
    if(statusMessage) statusMessage.textContent = "请先登录您的账户。";
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/user/status`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error('Error fetching user status:', response.status, response.statusText);
      const errorData = await response.json().catch(() => ({})); // 尝试解析错误信息
      console.error('Error details:', errorData);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('User status received:', data);
    updateStatusUI(data); // 更新 UI

  } catch (error) {
    console.error('Failed to fetch user status:', error);
    updateStatusUI(null); // 更新 UI 为失败状态
  }
}

document.addEventListener('DOMContentLoaded', function() {
  console.log("Popup DOM fully loaded and parsed");

  // DOM 加载完成后立即获取用户状态
  fetchUserStatus();

  const startButton = document.getElementById('start-button');
  const statusMessage = document.getElementById('status-message');
  const jobCountInput = document.getElementById('job-count'); // 获取数字输入框

  if (startButton && statusMessage && jobCountInput) { // 确保所有元素都存在
    startButton.addEventListener('click', () => {
      console.log("Start button clicked.");
      const jobCount = parseInt(jobCountInput.value, 10); // 读取输入的数量
      if (isNaN(jobCount) || jobCount < 1) {
        statusMessage.textContent = "请输入有效的处理数量 (大于0)";
        return;
      }
      
      statusMessage.textContent = `准备处理 ${jobCount} 个职位...`;
      startButton.disabled = true; // 防止重复点击

      // 获取当前活动的标签页
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const currentTab = tabs[0];
        if (currentTab && currentTab.id) {
          // 检查当前页面是否是 Boss 直聘
          if (currentTab.url && currentTab.url.includes('zhipin.com')) {
             console.log(`Sending startAutoGreeting message to tab ${currentTab.id} with count: ${jobCount}`);
            // 向 content script 发送开始处理的消息，并带上处理数量
            chrome.tabs.sendMessage(currentTab.id, { action: "startAutoGreeting", count: jobCount }, (response) => {
              if (chrome.runtime.lastError) {
                console.error("Error sending message:", chrome.runtime.lastError.message);
                statusMessage.textContent = `错误: ${chrome.runtime.lastError.message}`;
                startButton.disabled = false;
              } else {
                console.log("Message sent, response from content script:", response);
                statusMessage.textContent = response?.status || "已发送开始指令";

                // --- 如果 content script 返回了更新后的状态，则更新UI ---
                // 注意：这需要 content_script 在处理完投递后，通过 response 返回最新的状态信息
                // 例如: response = { status: '...', remainingSubmissions: 199, limit: 200, isMember: true }
                if (response && typeof response.remainingSubmissions !== 'undefined') {
                  console.log('Updating UI based on response from content script');
                  updateStatusUI(response);
                } else {
                  // 如果 content script 没有返回状态，可以选择在这里重新获取一次，或者依赖下一次打开 popup 时刷新
                  // fetchUserStatus(); // 可以取消注释这行来强制刷新，但可能不是最优选择
                }
                // --- 结束处理 --- 
                
                // 按钮状态恢复逻辑可以根据需要调整
                setTimeout(() => {
                    startButton.disabled = false;
                    // statusMessage.textContent = "可以开始新任务或处理下一个职位了"; // 可以考虑移除或修改这个文本
                }, 1500); // 缩短延迟时间
              }
            });
          } else {
            statusMessage.textContent = "请先切换到 Boss 直聘页面再试。";
            startButton.disabled = false;
          }
        } else {
          console.error("Could not get current tab ID.");
          statusMessage.textContent = "无法获取当前标签页";
          startButton.disabled = false;
        }
      });
    });
  } else {
    console.error("Could not find start button, status message, or job count input element in popup.");
  }
}); 