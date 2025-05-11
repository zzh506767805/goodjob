console.log("Background service worker started.");

// 后台 API 地址常量
//const API_BASE_URL = 'https://bosszhipin.work'; // 先注释掉线上地址
 const API_BASE_URL = 'http://localhost:3000'; // 修改为本地开发服务器地址

// 监听来自 content script 或 popup 的消息
console.log("Background: Adding onMessage listener...");
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Background: onMessage triggered. Request:", request, "Sender:", sender);
  
  // --- 新增：处理获取用户状态请求 ---
  if (request.action === "getUserStatus") {
    console.log("📊 Background: Received getUserStatus request");
    
    (async () => {
      try {
        const result = await chrome.storage.local.get(['authToken']);
        const token = result.authToken;
        if (!token) {
          console.error("❌ Background: Auth token not found for getUserStatus");
          sendResponse({ 
            error: "用户未登录", 
            limitReached: false, 
            remainingSubmissions: 0,
            isEffectivelyMember: false
          });
          return;
        }
        
        // 调用后端API获取用户状态
        console.log("✅ Background: Retrieved auth token for getUserStatus. Calling API...");
        const apiUrl = `${API_BASE_URL}/api/user/status`;
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: `API请求失败，状态码: ${response.status}` }));
          console.error(`❌ Background: user/status API call failed:`, errorData);
          sendResponse({ 
            error: errorData.error || `获取用户状态失败 (${response.status})`, 
            limitReached: false,
            remainingSubmissions: 3, // 默认给非会员的限制
            isEffectivelyMember: false
          });
          return;
        }

        const data = await response.json();
        console.log("✅ Background: Received user status from API:", data);
        
        // 提取必要信息并返回
        const userStatus = {
          name: data.name || null, // 添加用户名字段
          email: data.email || null, // 添加邮箱字段
          remainingSubmissions: data.remainingSubmissions || 0,
          limitReached: data.remainingSubmissions <= 0,
          isEffectivelyMember: data.isEffectivelyMember || false,
          membershipExpiry: data.membershipExpiry || null,
          limit: data.isEffectivelyMember ? 200 : 3
        };
        
        console.log("📊 Background: Sending user status to content script:", userStatus);
        sendResponse(userStatus);
        
      } catch (error) {
        console.error("❌ Background: Error in getUserStatus:", error);
        sendResponse({ 
          error: `获取用户状态时发生错误: ${error.message}`,
          limitReached: false,
          remainingSubmissions: 3, // 默认值
          isEffectivelyMember: false
        });
      }
    })();
    
    return true; // 异步处理
  }
  
  if (request.action === "processJobPage") {
    console.log("Background: Processing job page data:", request.details);
    
    // 1. 从 Chrome 存储中获取用户 Token
    chrome.storage.local.get(['authToken'], async (result) => {
      const token = result.authToken;
      if (!token) {
        console.error("Background: Auth token not found in storage for processJobPage.");
        sendResponse({ success: false, error: "用户未登录或Token丢失" });
        return;
      }
      console.log("Background: Retrieved auth token for processJobPage.");
      
      // 2. 调用后端 API 生成打招呼语
      try {
        const apiUrl = `${API_BASE_URL}/api/generate-greeting`;
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          },
          body: JSON.stringify(request.details)
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: `API 请求失败，状态码: ${response.status}` })); // 添加错误处理
          console.error(`Background: generate-greeting API call failed with status ${response.status}:`, errorData);
          throw new Error(errorData.error || `API 请求失败，状态码: ${response.status}`);
        }

        const data = await response.json();
        console.log("Background: Received greeting from API:", data.greeting);
        
        // 3. 将生成的打招呼语发送回 content script
        sendResponse({ success: true, greeting: data.greeting });
        
      } catch (error) {
        console.error("Background: Error calling generate-greeting API or processing response:", error);
        sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    });
    
    return true; // 表示会异步发送响应
  }
  
  // 监听来自网页的消息，用于保存 Token
  if (request.action === "saveAuthToken") {
    console.log("Background: Handling saveAuthToken action (from content script)...");
    if (request.token) {
      chrome.storage.local.set({ authToken: request.token }, () => {
        if (chrome.runtime.lastError) {
          console.error("Background: Error saving auth token:", chrome.runtime.lastError);
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
          console.log("Background: Auth token saved successfully.");
          sendResponse({ success: true });
        }
      });
      return true; // 异步响应
    } else {
      console.error("Background: Received saveAuthToken request without token.");
      sendResponse({ success: false, error: "未提供Token" });
    }
  }
  
  // --- 新增：处理记录投递成功请求 --- 
  if (request.action === "trackSubmission") {
    console.log("📊📊📊 Background: Received trackSubmission request with data:", request.data);
    // 异步处理，不阻塞 content script
    (async () => {
      try {
        const result = await chrome.storage.local.get(['authToken']);
        const token = result.authToken;
        if (!token) {
          console.error("❌❌❌ Background: Auth token not found in storage for trackSubmission.");
          // 不需要 sendResponse，因为 content script 不等待
          return;
        }
        console.log("✅ Background: Retrieved auth token for trackSubmission:", token.substring(0, 10) + "...");

        const apiUrl = `${API_BASE_URL}/api/track-submission`; // 确认后台 API 路径
        console.log("📤 Background: Sending data to API:", apiUrl);
        
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(request.data) // 发送 content script 传来的数据
        });

        if (!response.ok) {
           // 尝试解析错误信息，如果解析失败则用状态码
          let errorMsg = `API 请求失败，状态码: ${response.status}`;
          try {
              const errorData = await response.json();
              errorMsg = errorData.error || errorMsg;
              console.error(`❌❌❌ Background: track-submission API call failed:`, errorData);
          } catch (parseError) {
              console.warn("❌ Could not parse error response from track-submission API:", parseError);
          }
          console.error(`❌❌❌ Background: track-submission API call failed:`, errorMsg);
          // 这里可以选择是否做一些重试或其他错误处理，但同样不阻塞
        } else {
          try {
            const responseData = await response.json();
            console.log("✅✅✅ Background: API success response from track-submission:", responseData);
            // 尝试发送响应给content script (即使它可能不关心)
            try {
              sendResponse(responseData);
            } catch (respError) {
              console.log("Note: Could not send response back to content script (expected)");
            }
          } catch (jsonError) {
            console.warn("❌ Could not parse success response as JSON:", jsonError);
          }
        }
      } catch (error) {
        console.error("❌❌❌ Background: Error during trackSubmission API call:", error);
        // 同样，记录错误即可，不阻塞
      }
    })(); // 立即执行这个异步匿名函数

    // **重要**: 即使后台 API 调用是异步的，这里也需要返回 true
    // 表明你会异步地处理这个消息 (即使 content script 不关心结果)
    // 否则 Chrome 可能会过早关闭消息通道
    // 虽然在"发送后不管"模式下影响不大，但这是推荐的最佳实践
    // sendResponse({}); // 可以发送一个空响应，但不必要
    return true; 
  }
  
  return false; // 对其他消息类型同步返回 false
});
console.log("Background: onMessage listener updated with trackSubmission handler.");

// 添加一个专门监听外部连接的监听器
console.log("Background: Adding onMessageExternal listener...");
chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
  console.log("Background: onMessageExternal triggered. Request:", request, "Sender:", sender);

  if (!sender.origin.includes("bosszhipin.work")) {
    console.warn("Background: Received external message from unexpected origin:", sender.origin);
    return false; // 拒绝非预期的来源
  }

  if (request.action === "saveAuthToken") {
    console.log("Background (External): Handling saveAuthToken action...");
    if (request.token) {
      chrome.storage.local.set({ authToken: request.token }, () => {
        if (chrome.runtime.lastError) {
          console.error("Background (External): Error saving auth token:", chrome.runtime.lastError);
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
          console.log("Background (External): Auth token saved successfully.");
          sendResponse({ success: true });
        }
      });
      return true; // 异步响应
    } else {
      console.error("Background (External): Received saveAuthToken request without token.");
      sendResponse({ success: false, error: "未提供Token" });
    }
  }
  
  // 可以添加处理其他外部消息的逻辑
  console.warn("Background (External): Received unknown action:", request.action);
  return false; // 对未知 action 同步返回 false
});
console.log("Background: onMessageExternal listener added.");

// 监听插件安装或更新事件
chrome.runtime.onInstalled.addListener(() => {
  console.log("插件已安装或更新，准备刷新简历...");
  forceRefreshUserResume();
});

async function forceRefreshUserResume() {
  try {
    const result = await chrome.storage.local.get(['authToken']);
    const token = result.authToken;
    if (!token) {
      console.error("No auth token found for resume refresh");
      return false;
    }
    
    // 调用刷新接口
    const apiUrl = `${API_BASE_URL}/api/resumes/refresh-default`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
    
    if (!response.ok) {
      console.error("Failed to refresh resume data");
      return false;
    }
    
    console.log("✅ Successfully refreshed resume data");
    return true;
  } catch (error) {
    console.error("Error refreshing resume:", error);
    return false;
  }
} 