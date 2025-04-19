console.log("Content script injected.");

// --- 配置项 ---
const ACTION_DELAY_MIN = 200; // 操作之间最小延迟 (毫秒)
const ACTION_DELAY_MAX = 1000; // 操作之间最大延迟 (毫秒)
const CHAT_PAGE_LOAD_DELAY = 3000; // 预估聊天页面加载时间
const NAVIGATION_DELAY = 2000; // 页面跳转后的等待时间 (毫秒)
const NEXT_JOB_CLICK_DELAY = 1500; // 点击下一个职位后的等待时间

// --- CSS 选择器 (恢复原始选择器，并补充循环必须的) ---
const SELECTORS = {
  // 原始选择器 (用于提取激活职位信息和点击)
  jobTitle: '#wrap > div.job-recommend-main > div.job-recommend-result > div > div > div.job-list-container > ul > div.job-card-wrap.active > li > div.job-info > div > a',
  companyName: '#wrap > div.job-recommend-main > div.job-recommend-result > div > div > div.job-list-container > ul > div.job-card-wrap.active > li > div.job-card-footer > a > span',
  jobDescriptionContainer: 'p.desc', // 详情区描述
  startChatButton: '#wrap > div.job-recommend-main > div.job-recommend-result > div > div > div.job-detail-container > div > div.job-detail-header > div.job-detail-op.clearfix > a.op-btn.op-btn-chat',
  continueChatButtonPopup: 'body > div.greet-boss-dialog > div.greet-boss-container > div.greet-boss-footer > a.default-btn.sure-btn', 
  chatInput: '#chat-input',
  chatSendButton: '#container > div > div > div.chat-conversation > div.message-controls > div > div:nth-child(2) > div.chat-op > button',

  // 补充的选择器 (用于列表循环)
  jobListContainer: '.job-list-container', // 识别列表页的容器
  jobListItems: '.job-list-container .job-card-wrap', // 获取所有职位卡片
  nextJobTitleLink: '.job-info a' // 在任意职位卡片内查找标题链接用于点击
};

// --- 辅助函数 ---
function getTextContent(selector) {
  const element = document.querySelector(selector);
  if (!element) return null;

  let visibleText = '';
  // 遍历所有子节点
  element.childNodes.forEach(node => {
    // 如果是文本节点，直接添加内容
    if (node.nodeType === Node.TEXT_NODE) {
      visibleText += node.textContent;
    } 
    // (可选) 如果是元素节点... (保持注释不变)
  });
  // 清理多余的空白字符
  return visibleText.replace(/\s+/g, ' ').trim();
}

function getRandomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// 模拟点击，增加健壮性
async function safeClick(selector) {
  console.log(`Attempting to find element: ${selector}`);
  const element = document.querySelector(selector);
  if (element && typeof element.click === 'function') {
    console.log(`Element found. Attempting to click: ${selector}`);
    element.click();
    await new Promise(resolve => setTimeout(resolve, getRandomDelay(ACTION_DELAY_MIN / 2, ACTION_DELAY_MAX / 2)));
    return true;
  } else {
    console.error(`Element not found or not clickable: ${selector}`);
    return false;
  }
}

// 通过模拟键盘事件填充 contenteditable div
async function fillInputBySimulatingKeys(text) {
  console.log("[Input Simulation] Attempting to fill contenteditable input by simulating keys...");
  const element = document.querySelector(SELECTORS.chatInput);

  // 修改类型检查，允许 HTMLElement (包括 div)
  if (!element || !(element instanceof HTMLElement)) { 
    console.error(`[Input Simulation] Chat input not found or not an HTMLElement: ${SELECTORS.chatInput}`);
    return false;
  }
  // 检查是否是 contenteditable
  if (element.getAttribute('contenteditable') !== 'true') {
    console.error(`[Input Simulation] Chat input element is not contenteditable: ${SELECTORS.chatInput}`);
    return false;
  }

  console.log("[Input Simulation] Found contenteditable chat input element.");
  element.focus();
  // 对于 contenteditable，使用 textContent 清空和填充
  element.textContent = ''; 

  for (const char of text) {
    // 模拟按键按下
    element.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true, cancelable: true }));
    // 使用 textContent 更新
    element.textContent += char; 
    // 模拟输入事件 (重要！框架可能依赖这个)
    element.dispatchEvent(new Event('input', { bubbles: true, data: char, inputType: 'insertText' })); 
    // 模拟按键抬起
    element.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true, cancelable: true }));
    
    // 短暂随机延迟模拟打字间隔
    await new Promise(resolve => setTimeout(resolve, getRandomDelay(5, 15))); 
  }
  
  // 最后再触发一次 change 事件 (可能不需要，但以防万一)
  element.dispatchEvent(new Event('change', { bubbles: true }));
  
  console.log(`[Input Simulation] Finished simulation. Final input textContent: ${element.textContent}`);
  // 检查 textContent 是否匹配
  return element.textContent.includes(text.substring(0, 10)); 
}

// --- 状态管理与核心流程 ---

const STATE_KEY = 'multiJobState';

// 获取当前状态
async function getState() {
  const result = await chrome.storage.local.get([STATE_KEY]);
  return result[STATE_KEY] || { status: 'IDLE', totalCount: 0, processedCount: 0, currentJobIndex: -1 }; // 默认状态
}

// 更新状态
async function updateState(newState) {
  await chrome.storage.local.set({ [STATE_KEY]: newState });
  console.log("State updated:", newState);
}

// 清除状态
async function clearState() {
  await chrome.storage.local.remove(STATE_KEY);
  console.log("State cleared.");
}

// 检查当前是否处于等待发送消息的状态 (聊天页面加载后执行)
async function checkAndPerformPendingSend() {
  let state = await getState(); // Use let
  
  const isOnChatPage = window.location.href.includes('/chat/im?') || window.location.href.includes('/web/geek/chat');

  if (isOnChatPage && state.status === 'WAITING_TO_SEND_ON_CHAT_PAGE' && state.greetingToSend) {
    console.log("[Check State] State: Waiting to send on chat page. Greeting:", state.greetingToSend);
    
    await new Promise(resolve => setTimeout(resolve, CHAT_PAGE_LOAD_DELAY)); 
    
    const inputSuccess = await fillInputBySimulatingKeys(state.greetingToSend);
    
    if (inputSuccess) {
      console.log("[Input Simulation] Input filled successfully via key simulation.");
      await new Promise(resolve => setTimeout(resolve, getRandomDelay(500, 1000))); 
      
      if (await safeClick(SELECTORS.chatSendButton)) {
         console.log("Send button clicked successfully. Message sent.");
         
         // *** 新增：发送投递成功记录给 background.js ***
         if (state.currentProcessingJobDetails) { // 确保详情存在
            const submissionData = {
                jobTitle: state.currentProcessingJobDetails.jobTitle,
                companyName: state.currentProcessingJobDetails.companyName,
                jobDescription: state.currentProcessingJobDetails.jobDescription,
                greeting: state.greetingToSend,  // 添加发送的打招呼内容
                platformLink: window.location.href,  // 添加平台链接
                timestamp: new Date().toISOString()
            };
            console.log("📣📣📣 Sending submission tracking data to background:", submissionData);
            chrome.runtime.sendMessage({ action: "trackSubmission", data: submissionData }, (response) => {
                if (chrome.runtime.lastError) {
                    // 只记录错误，不阻塞流程
                    console.error("❌❌❌ Error sending submission tracking message to background:", chrome.runtime.lastError.message);
                } else {
                    // 成功日志
                    console.log("✅✅✅ Submission tracking message sent to background:", response);
                }
            });
         } else {
            console.warn("⚠️⚠️⚠️ Could not find currentProcessingJobDetails in state to track submission.");
         }
         
         // 更新状态：标记当前职位处理完成
         state.processedCount += 1;
         state.status = 'MESSAGE_SENT_GOING_BACK';
         state.greetingToSend = null;
         state.currentProcessingJobDetails = null; // 清理已发送的数据
         await updateState(state);
         
         // 发送成功后，自动返回上一页 (职位列表页) - 在发送消息之后执行！
         console.log("Navigating back to job list page...");
         await new Promise(resolve => setTimeout(resolve, getRandomDelay(ACTION_DELAY_MIN / 2, ACTION_DELAY_MAX / 2))); // 短暂延迟
         window.history.back(); // 触发浏览器后退
         
      } else {
         console.error("Failed to click send button after input simulation. Stopping process.");
         alert("文本已填入，但自动点击发送按钮失败，请手动发送。流程已停止。"); 
         await clearState(); // 失败时清除状态
      }
    } else {
      console.error("[Input Simulation] Failed to fill input via key simulation. Stopping process.");
      alert("自动填充打招呼内容失败，流程已停止。");
      await clearState(); // 失败时清除状态
    }
  } else if (state.status !== 'IDLE') {
     // 如果不在聊天页面但状态不是 IDLE, 可能是刚返回列表页, 调用 checkAndProcessNextJob
     // 或者可能是其他页面状态异常，让 checkAndProcessNextJob 去判断
     console.log("[Check State] Not on chat page or state incorrect. Checking if next job needs processing...");
     await checkAndProcessNextJob(); // *** 修改点: 让 checkAndProcessNextJob 处理非聊天页的逻辑 ***
  } else {
      console.log("[Check State] Not on chat page and state is IDLE. Doing nothing.");
  }
}

// 检查是否需要处理下一个职位 (列表页加载后执行)
async function checkAndProcessNextJob() {
  let state = await getState(); // 使用 let 以允许修改

  // 结合URL和元素判断是否在列表页
  const isOnListPageByURL = window.location.href.includes('/web/geek/job-recommend') || window.location.href.includes('/web/geek/job-brand') || window.location.href.includes('/c/search/joblist'); // 扩展列表页 URL 检测
  const hasListContainer = document.querySelector(SELECTORS.jobListContainer);
  const isOnListPage = isOnListPageByURL || hasListContainer;

  if (!isOnListPage) {
    console.log("[Check Next Job] Not identified as job list page. Current status:", state.status);
    const isOnChatPage = window.location.href.includes('/chat/im?') || window.location.href.includes('/web/geek/chat');
    if (state.status !== 'IDLE' && !isOnChatPage) {
      console.warn("Not on list/chat page, but state is active. Clearing state.");
      alert("似乎不在职位列表或聊天页面，但流程状态异常，已重置。");
      await clearState();
    }
    return;
  }

  console.log("[Check Next Job] Identified as job list page.");

  // 确保在刚返回时等待页面刷新和稳定
  if (state.status === 'MESSAGE_SENT_GOING_BACK') {
    console.log("Waiting for list page elements to stabilize after navigation...");
    await new Promise(resolve => setTimeout(resolve, NAVIGATION_DELAY));
    if (!document.querySelector(SELECTORS.jobListContainer)){
        console.error("List container not found after delay. Stopping.");
        alert("返回列表页后等待超时，未能找到职位列表容器，流程停止。");
        await clearState();
        return;
    }
     console.log("Page stabilized, transitioning to LOOKING_FOR_NEXT_JOB.");
     state.status = 'LOOKING_FOR_NEXT_JOB'; // 更新状态以便继续
     // 注意：这里不需要立即 updateState，因为下面的逻辑会再次更新
  }

  // 检查状态是否应该处理 (LOOKING_FOR_NEXT_JOB)
  if (state.status === 'LOOKING_FOR_NEXT_JOB') {
    console.log(`[Check Next Job] Status is LOOKING_FOR_NEXT_JOB. Processed: ${state.processedCount}, Total: ${state.totalCount}`);

    // 检查是否还有剩余任务
    if (state.processedCount < state.totalCount) {
      // *** 恢复显式查找和点击下一个职位的逻辑 ***
      const nextJobIndex = state.currentJobIndex + 1; // 计算下一个索引
      console.log(`Attempting to find and click job card at index: ${nextJobIndex}`);
      const jobCards = document.querySelectorAll(SELECTORS.jobListItems);

      if (jobCards.length === 0) {
        console.error("Could not find any job cards on the page. Stopping.");
        alert("未能在此页面上找到任何职位卡片，请确认页面是否正确加载。流程停止。");
        await clearState();
        return;
      }

      if (nextJobIndex < jobCards.length) {
        const nextJobCard = jobCards[nextJobIndex];
        // 尝试在卡片内查找标题链接
        const jobTitleLink = nextJobCard.querySelector(SELECTORS.nextJobTitleLink);

        if (jobTitleLink && typeof jobTitleLink.click === 'function') {
          console.log(`Found job title link for index ${nextJobIndex}. Clicking...`);
          jobTitleLink.scrollIntoView({ behavior: 'smooth', block: 'center' }); // 滚动到视图
          await new Promise(resolve => setTimeout(resolve, 300)); // 等待滚动
          jobTitleLink.click(); // 点击链接以加载详情
          await new Promise(resolve => setTimeout(resolve, NEXT_JOB_CLICK_DELAY)); // 等待详情加载

          // 更新状态，记录当前处理的索引，并标记下一步是处理详情
          state.currentJobIndex = nextJobIndex;
          state.status = 'PROCESSING_JOB_DETAILS';
          await updateState(state);
          console.log(`State updated for processing job index ${nextJobIndex}.`);

          // 调用函数处理新激活的职位详情
          await processCurrentJobDetails();

        } else {
          console.error(`Could not find or click the title link for job card at index ${nextJobIndex}. Selector: ${SELECTORS.nextJobTitleLink}`);
          alert(`未能找到或点击第 ${nextJobIndex + 1} 个职位的链接 (Selector: ${SELECTORS.nextJobTitleLink})，流程停止。`);
          await clearState();
        }
      } else {
        // 想要处理的索引超出了页面上的卡片数量
        console.log(`Reached end of job list on page (tried index ${nextJobIndex}, found ${jobCards.length}).`);
        // 检查是否完成了目标数量
        if (state.processedCount >= state.totalCount) {
          console.log("All targeted jobs processed!");
          alert(`任务完成！成功处理了 ${state.processedCount} 个职位。`);
        } else {
           console.warn(`Reached end of job list on page before processing target count (${state.processedCount}/${state.totalCount}). Stopping.`);
           alert(`已处理完当前页面的所有职位 (${jobCards.length}个)，但未达到目标数量 (${state.totalCount})。流程已停止。`);
        }
        await clearState(); // 清理状态
      }
      // *** 结束恢复的逻辑 ***

    } else {
      // 所有指定数量的职位都处理完了
      console.log("All jobs processed!");
      alert(`任务完成！成功处理了 ${state.processedCount} 个职位。`);
      await clearState(); // 清理状态
    }
  } else if (state.status === 'IDLE') {
      console.log("[Check Next Job] On list page, but status is IDLE. Doing nothing.");
  } else {
      // 捕获其他未预料到的状态
      console.warn(`[Check Next Job] On list page, but found unexpected state '${state.status}'. Clearing state.`);
      alert(`在列表页面检测到意外的流程状态 (${state.status})，已重置。`);
      await clearState();
  }
}

// 处理当前选中的职位详情 (提取信息 -> 获取招呼语 -> 点击沟通)
async function processCurrentJobDetails() {
    let state = await getState(); // Use let to allow modification
    if (state.status !== 'PROCESSING_JOB_DETAILS') {
        console.warn("Called processCurrentJobDetails with incorrect state:", state.status);
        return; // 防止意外调用
    }

    console.log(`Processing details for job index: ${state.currentJobIndex}. Using original selectors for active elements.`);

    // 1. 提取当前选中职位的信息 (使用原始的、精确的选择器)
    console.log("Extracting job details using specific selectors for the active job...");
    const jobDetailContainer = document.querySelector('.job-detail-container');
  const jobDetails = {
    jobTitle: getTextContent(SELECTORS.jobTitle),
    companyName: getTextContent(SELECTORS.companyName),
        jobDescription: jobDetailContainer ? getTextContentFromElement(jobDetailContainer.querySelector(SELECTORS.jobDescriptionContainer)) : null,
        jobRequirements: ""
  };

    function getTextContentFromElement(element) {
        return element ? element.textContent.replace(/\s+/g, ' ').trim() : null;
    }

  if (!jobDetails.jobTitle || !jobDetails.jobDescription) {
        console.error("Failed to extract essential job details... stopping."); // Simplified log
        alert("未能提取到当前选中职位的关键信息（标题或描述），流程停止。");
        await clearState();
    return;
  }
  console.log("Extracted job details:", jobDetails);

    // *** 新增：将当前处理的职位详情存入 state ***
    state.currentProcessingJobDetails = jobDetails; 

  // 2. 发送给 Background 获取打招呼语
  console.log("Sending job details to background script...");
  try {
    const response = await chrome.runtime.sendMessage({ action: "processJobPage", details: jobDetails });
    console.log("Received response from background:", response);

    if (response && response.success && response.greeting) {
      const greetingToSend = response.greeting;
      console.log("Greeting received:", greetingToSend);

            // 3. 更新状态和消息，准备跳转到聊天页面
            // *** 把上面保存了 jobDetails 的 state 传给 updateState ***
            state.status = 'WAITING_TO_SEND_ON_CHAT_PAGE';
            state.greetingToSend = greetingToSend;
            await updateState(state); // Now state includes currentProcessingJobDetails
            console.log("State updated (incl. job details). Ready to navigate to chat page.", state);

            // 4. 点击"立即沟通" (使用原始选择器)
            console.log("Attempting step 4: Click Start Chat Button using original selector:", SELECTORS.startChatButton);
      if (await safeClick(SELECTORS.startChatButton)) {
        // 5. 等待并点击弹窗中的"继续沟通"
        console.log("Start chat button clicked successfully. Waiting for popup...");
                await new Promise(resolve => setTimeout(resolve, getRandomDelay(ACTION_DELAY_MIN, ACTION_DELAY_MAX)));
                console.log("Attempting step 5: Click Continue Chat Button in Popup using selector:", SELECTORS.continueChatButtonPopup);
        if (await safeClick(SELECTORS.continueChatButtonPopup)) {
                    console.log("Clicked continue in popup. Navigation to chat page should occur.");
                    // 页面即将跳转，后续由聊天页面的 content script 的 checkAndPerformPendingSend 接管
        } else {
                    console.error("Failed to click continue button in popup. Stopping.");
                    alert("未能点击弹窗中的'继续沟通'按钮，流程停止。");
                    await clearState();
        }
      } else {
                console.error("Failed to click start chat button using original selector. Stopping.");
                alert("未能找到或点击'立即沟通'按钮 (使用原始选择器)，流程停止。");
                await clearState();
      }
    } else {
      console.error("Failed to get greeting from background:", response?.error);
            alert(`生成打招呼语失败: ${response?.error || '未知错误'}，流程停止。`);
            await clearState();
    }
  } catch (error) {
    console.error("Error during job processing flow:", error);
        alert(`处理过程中发生错误: ${error.message}，流程停止。`);
        await clearState();
  }
}

// --- 初始化与 Token 处理 ---

// 检查用户今日投递限制状态
async function checkUserSubmissionLimits() {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action: "getUserStatus" }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("❌ Error checking user submission limits:", chrome.runtime.lastError);
        reject(chrome.runtime.lastError);
        return;
      }
      console.log("✅ User status check response:", response);
      resolve(response);
    });
  });
}

// 监听来自网页的 Token 消息 (与之前相同)
window.addEventListener("message", (event) => {
  if (event.source === window && event.data && event.data.type === "AUTH_TOKEN_FROM_PAGE") {
    console.log("Content Script: Received auth token from web page.");
    const token = event.data.token;
    if (token) {
      chrome.runtime.sendMessage({ action: "saveAuthToken", token: token }, (response) => {
         if (chrome.runtime.lastError) {
             console.error("Error sending token to background:", chrome.runtime.lastError.message);
         } else if (response && !response.success) {
             console.error("Background script failed to save token:", response.error);
         } else {
             console.log("Token successfully sent to background script.");
         }
      });
    } else {
        console.warn("Received AUTH_TOKEN_FROM_PAGE message but token was empty.");
    }
  }
}, false);

// 修改监听来自 popup 的消息来启动流程
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "startAutoGreeting") {
    console.log(`Received startAutoGreeting command from popup with count: ${request.count}`);

    // 检查是否在职位列表页
    if (!document.querySelector(SELECTORS.jobListContainer)) {
        alert("请先确保当前页面是 Boss 直聘的职位列表或推荐页面！");
        sendResponse({ status: "Error: Not on job list page" });
        return false; // 同步返回 false
    }

    // 初始化状态并开始处理第一个职位
    async function startMultiJobProcessing() {
      // 先检查用户是否已达到投递限制
      try {
        const userStatus = await checkUserSubmissionLimits();
        if (userStatus.limitReached || userStatus.remainingSubmissions <= 0) {
          // 用户已达到投递上限
          let message = "您今日的投递次数已用完！";
          if (userStatus.isEffectivelyMember) {
            message += "作为会员，您每日可投递200次。";
          } else {
            message += "非会员每日限3次。升级会员可享受每日200次投递特权！";
          }
          alert(message);
          sendResponse({ 
            status: "Error: User has reached submission limit", 
            limitReached: true,
            remainingSubmissions: 0,
            limit: userStatus.isEffectivelyMember ? 200 : 3,
            isMember: userStatus.isEffectivelyMember
          });
          return;
        }

        // 检查剩余次数是否足够处理请求的数量
        if (userStatus.remainingSubmissions < request.count) {
          const confirmMsg = `您今日还剩${userStatus.remainingSubmissions}次投递机会，少于请求的${request.count}次。是否继续并只处理${userStatus.remainingSubmissions}次？`;
          if (!confirm(confirmMsg)) {
            sendResponse({ 
              status: "Cancelled: Not enough remaining submissions", 
              limitReached: false,
              remainingSubmissions: userStatus.remainingSubmissions,
              limit: userStatus.isEffectivelyMember ? 200 : 3,
              isMember: userStatus.isEffectivelyMember
            });
            return;
          }
          // 如果用户确认，则修改count为剩余次数
          request.count = userStatus.remainingSubmissions;
        }
      } catch (error) {
        console.warn("❗ Failed to check user submission limits. Proceeding without limitation check:", error);
        // 出错时，继续执行，不阻止用户使用
      }

      await clearState(); // 开始前先清理旧状态
      const initialState = {
        status: 'LOOKING_FOR_NEXT_JOB', // 初始状态设为寻找第一个职位
        totalCount: request.count || 1,
        processedCount: 0,
        currentJobIndex: -1, // 初始索引为-1，这样第一个就是0
        greetingToSend: null
      };
      await updateState(initialState);
      console.log("Initialized state for multi-job processing:", initialState);

      // 发回响应给 popup
      sendResponse({ status: `Processing started for ${initialState.totalCount} jobs` });

      // 触发处理第一个职位的逻辑
      console.log("Triggering checkAndProcessNextJob to start the loop...");
      await checkAndProcessNextJob(); // 调用修正后的检查函数开始流程

    }

    startMultiJobProcessing();
    return true; // 异步处理，返回 true
  } else if (request.action === "checkAndSyncToken") {
    // 处理来自popup的刷新登录状态请求
    console.log("收到请求：检查并同步token");
    
    // 判断是否在官网页面
    if (window.location.hostname.includes('bosszhipin.work')) {
      try {
        // 从localStorage中获取token
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        
        if (token) {
          console.log("找到auth token，发送给extension...");
          // 向background发送token
          chrome.runtime.sendMessage({ action: "saveAuthToken", token: token }, (response) => {
            if (chrome.runtime.lastError) {
              console.error("向background发送token错误:", chrome.runtime.lastError.message);
              sendResponse({ success: false, error: chrome.runtime.lastError.message });
            } else if (response && !response.success) {
              console.error("background保存token失败:", response.error);
              sendResponse({ success: false, error: response.error });
            } else {
              console.log("成功将token从网站发送到扩展。");
              sendResponse({ success: true, message: "登录状态已同步" });
            }
          });
          return true; // 异步响应
        } else {
          console.log("当前页面未找到token");
          sendResponse({ success: false, error: "当前页面未找到登录token" });
        }
      } catch (error) {
        console.error("检查token时出错:", error);
        sendResponse({ success: false, error: error.message });
      }
    } else {
      console.log("当前页面不是官网，无法同步登录状态");
      sendResponse({ success: false, error: "请先访问官网进行登录" });
    }
    return false;
  }
  return false; // 其他消息类型，同步返回 false
});

// --- 脚本入口点 ---

// 在官网页面检查并获取token
function checkForTokenOnWebsite() {
  // 判断是否在官网页面
  if (window.location.hostname.includes('bosszhipin.work')) {
    
    console.log("Content script running on official website. Checking for token...");
    
    // 尝试从localStorage中获取token
    const checkForToken = () => {
      try {
        // 从localStorage中获取token
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        
        if (token) {
          console.log("Found auth token on website. Sending to extension...");
          // 向扩展发送token
          chrome.runtime.sendMessage({ action: "saveAuthToken", token: token }, (response) => {
            if (chrome.runtime.lastError) {
              console.error("Error sending token to background:", chrome.runtime.lastError.message);
            } else if (response && !response.success) {
              console.error("Background script failed to save token:", response.error);
            } else {
              console.log("Token successfully sent from website to extension.");
            }
          });
        }
      } catch (error) {
        console.error("Error checking for token on website:", error);
      }
    };
    
    // 页面加载完成后检查一次
    checkForToken();
    
    // 创建一个MutationObserver监听页面变化，可能是登录状态变化
    const observer = new MutationObserver((mutations) => {
      // 当页面有变化时，尝试再次获取token
      checkForToken();
    });
    
    // 配置observer监听整个文档的子树变化
    observer.observe(document.body, { 
      childList: true, 
      subtree: true 
    });
    
    // 监听localStorage变化的事件
    window.addEventListener('storage', (event) => {
      if (event.key === 'authToken' || event.key === 'token') {
        console.log("LocalStorage token change detected");
        checkForToken();
      }
    });
    
    // 定期检查token是否存在（每30秒检查一次）
    setInterval(checkForToken, 30000);
  }
}

// 页面加载后，根据当前页面和状态决定执行哪个检查函数
async function initializeScript() {
    console.log("Content script initializing. Current URL:", window.location.href);
    await new Promise(resolve => setTimeout(resolve, 500)); // 等待页面初步加载
    
    // 检查是否在官网并获取token
    checkForTokenOnWebsite();

    const state = await getState();
    console.log("Initial state on load:", state);

    // 再次确认修改点: 放宽聊天页面的 URL 检查
    const isOnChatPage = window.location.href.includes('/chat/im?') || window.location.href.includes('/web/geek/chat');
    // *** 修改点: 结合URL和元素判断是否在列表页 ***
    const isOnListPageByURL = window.location.href.includes('/web/geek/job-recommend');
    const hasListContainer = document.querySelector(SELECTORS.jobListContainer);
    const isOnListPage = isOnListPageByURL || hasListContainer;

    if (isOnChatPage) {
        console.log("On chat page, checking for pending send...");
        await checkAndPerformPendingSend(); // 在聊天页检查是否要发送
    } else if (isOnListPage) {
        console.log("On job list/recommend page, checking for next job action...");
        await checkAndProcessNextJob(); // 在列表页检查是否要处理下一个
    } else {
        console.log("Not on a recognized page for automated actions (chat or list/recommend).");
        // 如果状态异常但不在已知页面，清理状态
        if (state.status !== 'IDLE') {
           console.warn(`Script initialized on an unrecognized page (${window.location.href}) with active state: ${state.status}. Clearing state.`);
           alert(`脚本在未知页面 (${window.location.href}) 加载，但存在未完成的任务状态，已重置。`);
           await clearState();
        }
    }
}

initializeScript(); 