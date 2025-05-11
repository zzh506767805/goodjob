console.log("Popup script loaded!");

// 后端 API 基础 URL (直接使用线上地址)
const API_BASE_URL = 'https://bosszhipin.work/api'; 
const WEBSITE_URL = 'https://bosszhipin.work'; // 官网地址

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

// 清除认证 Token（退出登录）
async function clearAuthToken() {
  return new Promise((resolve) => {
    chrome.storage.local.remove('authToken', () => {
      if (chrome.runtime.lastError) {
        console.error('清除token失败:', chrome.runtime.lastError);
        resolve(false);
      } else {
        console.log('已清除用户token');
        resolve(true);
      }
    });
  });
}

// 刷新登录状态
async function refreshLoginStatus() {
  const loginText = document.getElementById('login-text');
  
  if (loginText) {
    loginText.textContent = '正在同步登录状态...';
  }
  
  // 获取当前活动的标签页
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    if (currentTab && currentTab.id) {
      // 向当前标签页发送刷新登录状态的消息
      chrome.tabs.sendMessage(currentTab.id, { action: "checkAndSyncToken" }, (response) => {
        if (chrome.runtime.lastError) {
          console.error("刷新登录状态出错:", chrome.runtime.lastError.message);
          
          // 如果错误是因为content script不存在（不是官网页面），提示用户
          if (loginText) {
            loginText.textContent = '请先访问官网以同步登录状态';
          }
          
          // 2秒后重新检查登录状态
          setTimeout(() => checkLoginStatus(), 2000);
          return;
        }
        
        // 收到content script响应，更新登录状态
        console.log("收到刷新登录状态响应:", response);
        setTimeout(() => checkLoginStatus(), 1000);
      });
    } else {
      console.error("找不到当前标签页");
      if (loginText) loginText.textContent = '同步失败，请重试';
      setTimeout(() => checkLoginStatus(), 1000);
    }
  });
}

// 退出登录
async function logout() {
  const logoutSuccess = await clearAuthToken();
  
  if (logoutSuccess) {
    // 更新界面状态
    updateUIforLogout();
    return true;
  }
  return false;
}

// 更新界面为退出状态
function updateUIforLogout() {
  // 更新登录状态区域
  const loginText = document.getElementById('login-text');
  const loginButton = document.getElementById('login-button');
  const logoutButton = document.getElementById('logout-button');
  const startButton = document.getElementById('start-button');
  
  if (loginText) loginText.textContent = '未登录';
  if (loginButton) {
    loginButton.style.display = 'inline-block';
    loginButton.onclick = () => window.open(`${WEBSITE_URL}/auth/login`, '_blank');
  }
  if (logoutButton) logoutButton.style.display = 'none';
  
  // 禁用开始按钮
  if (startButton) {
    startButton.disabled = true;
    startButton.title = "请先登录后再使用";
    startButton.setAttribute('data-login-disabled', 'true');
  }
  
  // 更新投递状态区域
  const submissionStatus = document.getElementById('submission-status');
  const membershipPromo = document.getElementById('membership-promo');
  const membershipExpiry = document.getElementById('membership-expiry');
  
  if (submissionStatus) {
    submissionStatus.textContent = "请先登录后查看投递状态";
    submissionStatus.style.color = "#999";
  }
  
  // 隐藏会员相关区域
  if (membershipPromo) membershipPromo.style.display = 'none';
  if (membershipExpiry) membershipExpiry.style.display = 'none';
}

// 检查并更新登录状态
async function checkLoginStatus() {
  const loginText = document.getElementById('login-text');
  const loginButton = document.getElementById('login-button');
  const logoutButton = document.getElementById('logout-button');
  const startButton = document.getElementById('start-button');
  
  if (!loginText || !loginButton) {
    console.error('Login status elements not found');
    return;
  }
  
  const token = await getAuthToken();
  if (!token) {
    // 未登录状态
    loginText.textContent = '未登录';
    loginButton.style.display = 'inline-block';
    loginButton.onclick = () => window.open(`${WEBSITE_URL}/auth/login`, '_blank');
    
    // 隐藏退出按钮
    if (logoutButton) logoutButton.style.display = 'none';
    
    // 禁用开始按钮
    if (startButton) {
      startButton.disabled = true;
      startButton.title = "请先登录后再使用";
      startButton.setAttribute('data-login-disabled', 'true');
    }
    
    return false;
  }
  
  // 已有token，获取用户信息
  try {
    chrome.runtime.sendMessage({ action: "getUserStatus" }, (response) => {
      if (chrome.runtime.lastError || !response) {
        console.error("获取用户状态失败:", chrome.runtime.lastError);
        loginText.textContent = '登录状态异常';
        return;
      }
      
      // 用户名显示
      if (response.name) {
        loginText.innerHTML = `欢迎, <span class="user-name">${response.name}</span>`;
      } else {
        loginText.textContent = '已登录';
      }
      
      // 显示退出按钮，隐藏登录按钮
      loginButton.style.display = 'none';
      if (logoutButton) {
        logoutButton.style.display = 'inline-block';
        
        // 绑定退出点击事件
        logoutButton.onclick = async () => {
          logoutButton.disabled = true;
          logoutButton.textContent = '退出中...';
          const success = await logout();
          if (!success) {
            logoutButton.disabled = false;
            logoutButton.textContent = '退出';
            alert('退出登录失败，请重试');
          }
        };
      }
      
      // 移除登录禁用标记
      if (startButton) startButton.removeAttribute('data-login-disabled');
    });
    
    return true;
  } catch (error) {
    console.error('检查登录状态失败:', error);
    loginText.textContent = '登录状态异常';
    return false;
  }
}

// 更新 UI 显示状态的函数
function updateStatusUI(userStatus) {
  const submissionStatus = document.getElementById('submission-status');
  const membershipPromo = document.getElementById('membership-promo');
  const upgradeLink = document.getElementById('upgrade-link');
  const membershipExpiry = document.getElementById('membership-expiry');
  const startButton = document.getElementById('start-button');

  if (!submissionStatus) {
    console.error("Could not find status elements for update");
    return;
  }

  if (userStatus.error) {
    // 处理错误情况
    submissionStatus.textContent = `状态获取失败: ${userStatus.error}`;
    return;
  }
  
  // 设置投递状态文本
  const limit = userStatus.isEffectivelyMember ? 200 : 3;
  const remaining = userStatus.remainingSubmissions || 0;
  
  if (remaining <= 0) {
    // 没有剩余次数
    submissionStatus.textContent = `您今日的${limit}次投递已用完`;
    submissionStatus.style.color = 'red';
    
    // 禁用开始按钮
    if (startButton) {
      startButton.disabled = true;
      startButton.title = "已达到今日投递上限";
    }
  } else {
    // 有剩余次数
    submissionStatus.textContent = `今日已投递 ${limit - remaining}/${limit} 次，剩余 ${remaining} 次`;
    submissionStatus.style.color = remaining < 5 ? 'orange' : 'green';
    
    // 启用开始按钮（但仍需检查登录状态）
    if (startButton && !startButton.hasAttribute('data-login-disabled')) {
      startButton.disabled = false;
      startButton.title = "";
    }
  }
  
  // 会员信息显示
  if (membershipExpiry && membershipPromo) {
    if (userStatus.isEffectivelyMember) {
      // 显示会员到期日期
      const expiryDate = userStatus.membershipExpiry ? new Date(userStatus.membershipExpiry) : null;
      if (expiryDate) {
        const year = expiryDate.getFullYear();
        const month = (expiryDate.getMonth() + 1).toString().padStart(2, '0');
        const day = expiryDate.getDate().toString().padStart(2, '0');
        membershipExpiry.textContent = `会员有效期至: ${year}年${month}月${day}日`;
        membershipExpiry.style.display = 'block';
      }
      membershipPromo.style.display = 'none'; // 隐藏会员促销
    } else {
      // 显示会员促销
      membershipExpiry.style.display = 'none';
      membershipPromo.style.display = 'block';
    }
  }
}

// 获取用户状态并更新UI
function fetchUserStatus() {
  console.log('Fetching user status...');
  const submissionStatus = document.getElementById('submission-status');
  const membershipExpiry = document.getElementById('membership-expiry');
  const membershipPromo = document.getElementById('membership-promo');
  const upgradeLink = document.getElementById('upgrade-link');

  if (!submissionStatus) {
    console.error("Could not find submission-status element");
    return;
  }
  
  submissionStatus.textContent = "正在检查投递状态...";
  
  // 访问 background.js 获取用户状态
  chrome.runtime.sendMessage({ action: "getUserStatus" }, (response) => {
    if (chrome.runtime.lastError) {
      console.error("Error fetching user status:", chrome.runtime.lastError);
      submissionStatus.textContent = "无法获取投递状态，请刷新重试";
      return;
    }
    
    console.log("Received user status from background:", response);
    
    // 更新UI
    updateStatusUI(response);
  });
  
  // 设置会员升级链接
  if (upgradeLink) {
    upgradeLink.href = `${WEBSITE_URL}/pricing`; // 使用官网地址变量
    upgradeLink.target = "_blank";
  }
}

// 初始化链接
function initLinks() {
  const officialLink = document.getElementById('official-link');
  const dashboardLink = document.getElementById('dashboard-link');
  const versionSpan = document.getElementById('version');
  
  if (officialLink) {
    officialLink.href = WEBSITE_URL;
  }
  
  if (dashboardLink) {
    dashboardLink.href = `${WEBSITE_URL}/dashboard`;
  }
  
  // 获取并显示扩展版本号
  if (versionSpan && chrome.runtime.getManifest) {
    try {
      const manifest = chrome.runtime.getManifest();
      versionSpan.textContent = `v${manifest.version}`;
    } catch (error) {
      console.error('获取版本号失败:', error);
      versionSpan.textContent = 'v1.0.0';
    }
  }
}

document.addEventListener('DOMContentLoaded', function() {
  console.log("Popup DOM fully loaded and parsed");

  // 初始化所有链接
  initLinks();
  
  // 检查登录状态
  checkLoginStatus().then(isLoggedIn => {
    // 只有登录后才获取用户状态
    if (isLoggedIn) {
      fetchUserStatus();
    } else {
      const submissionStatus = document.getElementById('submission-status');
      if (submissionStatus) {
        submissionStatus.textContent = "请先登录后查看投递状态";
        submissionStatus.style.color = "#999";
      }
      
      // 隐藏会员相关区域
      const membershipPromo = document.getElementById('membership-promo');
      const membershipExpiry = document.getElementById('membership-expiry');
      if (membershipPromo) membershipPromo.style.display = 'none';
      if (membershipExpiry) membershipExpiry.style.display = 'none';
    }
  });

  // 为登录文本添加点击事件，作为刷新按钮
  const loginText = document.getElementById('login-text');
  if (loginText) {
    loginText.style.cursor = 'pointer';
    loginText.title = '点击刷新登录状态';
    loginText.addEventListener('click', refreshLoginStatus);
  }

  const startButton = document.getElementById('start-button');
  const statusMessage = document.getElementById('status-message');
  const jobCountInput = document.getElementById('job-count'); // 获取数字输入框
  const tabIndexSelect = document.getElementById('tab-index'); // 获取标签页选择下拉框

  if (startButton && statusMessage && jobCountInput && tabIndexSelect) { // 确保所有元素都存在
    startButton.addEventListener('click', () => {
      console.log("Start button clicked.");
      const jobCount = parseInt(jobCountInput.value, 10); // 读取输入的数量
      if (isNaN(jobCount) || jobCount < 1) {
        statusMessage.textContent = "请输入有效的处理数量 (大于0)";
        return;
      }
      
      // 获取标签页索引
      const targetTabIndex = parseInt(tabIndexSelect.value, 10);
      console.log(`目标标签页索引: ${targetTabIndex}`);
      
      let statusText = `准备处理 ${jobCount} 个职位`;
      if (targetTabIndex >= 0) {
        statusText += `，在第 ${targetTabIndex + 1} 个标签页下`;
      }
      statusMessage.textContent = statusText + "...";
      startButton.disabled = true;

      // 获取当前活动的标签页
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const currentTab = tabs[0];
        if (currentTab && currentTab.id) {
          // 检查当前页面是否是 Boss 直聘
          if (currentTab.url && currentTab.url.includes('zhipin.com')) {
            console.log(`Sending startAutoGreeting message to tab ${currentTab.id} with count: ${jobCount} and targetTabIndex: ${targetTabIndex}`);
            // 向 content script 发送开始处理的消息，并带上处理数量和目标标签页索引
            chrome.tabs.sendMessage(currentTab.id, { 
              action: "startAutoGreeting", 
              count: jobCount,
              targetTabIndex: targetTabIndex // 增加标签页索引参数
            }, (response) => {
              if (chrome.runtime.lastError) {
                console.error("Error sending message:", chrome.runtime.lastError.message);
                statusMessage.textContent = `错误: ${chrome.runtime.lastError.message}`;
                startButton.disabled = false;
              } else {
                console.log("Message sent, response from content script:", response);
                
                // 如果是用户达到限制导致的错误，更新UI显示
                if (response && response.limitReached) {
                  statusMessage.textContent = "您今日的投递次数已用完！";
                  updateStatusUI(response);
                } else {
                  statusMessage.textContent = response?.status || "已发送开始指令";
                }

                // --- 如果 content script 返回了更新后的状态，则更新UI ---
                if (response && typeof response.remainingSubmissions !== 'undefined') {
                  console.log('Updating UI based on response from content script');
                  updateStatusUI(response);
                }
                
                // 按钮状态恢复逻辑
                setTimeout(() => {
                  startButton.disabled = false;
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