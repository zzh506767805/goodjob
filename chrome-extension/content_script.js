console.log("Content script injected.");

// --- 配置项 ---
const ACTION_DELAY_MIN = 100; // 操作之间最小延迟 (毫秒)
const ACTION_DELAY_MAX = 500; // 操作之间最大延迟 (毫秒)
const CHAT_PAGE_LOAD_DELAY = 1500; // 预估聊天页面加载时间
const NAVIGATION_DELAY = 1200; // 页面跳转后的等待时间 (毫秒)
const NEXT_JOB_CLICK_DELAY = 500; // 点击下一个职位后的等待时间
const TAB_SWITCH_DELAY = 1000; // 切换标签页后的等待时间
const POPUP_APPEAR_DELAY = 1500; // 等待弹窗出现的时间，解决点击立即沟通后弹窗未完全显示的问题，失败时会重试
const JOB_DETAIL_LOAD_DELAY = 1200; // 职位详情页完全加载的等待时间
const MAX_INFO_EXTRACT_RETRIES = 3; // 职位信息提取的最大重试次数

// --- CSS 选择器 (使用多个备选选择器，按优先级排序) ---
const SELECTORS = {
  // 多个备选选择器，从新到旧排序
  jobTitle: [
    // 新增的选择器
    '#wrap > div.page-jobs-main > div.job-recommend-result > div > div > div.job-list-container > ul > div.card-area.is-seen > div > li > div.job-info > div > a',
    // 原有选择器
    '#wrap > div.page-jobs-main > div.job-recommend-result > div > div > div.job-list-container > ul > div.card-area.has-flag.is-seen > div > li > div.job-info > div > a',
    // 备用选择器
    '.job-info div a', // 更宽松的选择器，尝试匹配不同变体
    '.job-title' // 最宽松的选择器
  ],
  companyName: [
    // 新增的选择器
    '#wrap > div.page-jobs-main > div.job-recommend-result > div > div > div.job-list-container > ul > div.card-area.is-seen > div > li > div.job-card-footer > a > span',
    // 原有选择器
    '#wrap > div.page-jobs-main > div.job-recommend-result > div > div > div.job-list-container > ul > div.card-area.has-flag.is-seen > div > li > div.job-card-footer > a > span',

  ],
  // 保留之前扩展的描述选择器
  jobDescriptionContainer: '.job-sec .text, .job-description .text, .job-box .text, p.desc', 

  // --- 保留沟通和列表相关的选择器 ---
  startChatButton: [
    // 新版选择器
    '#wrap > div.page-jobs-main > div.job-recommend-result > div > div > div.job-detail-container > div.job-detail-box > div.job-detail-header > div.job-detail-op.clearfix > a.op-btn.op-btn-chat',
    // 通用选择器
    '.job-detail-op a.op-btn-chat',
    '.op-btn-chat',
    'a.primary.start-chat-btn'
  ],
  continueChatButtonPopup: 'body > div.greet-boss-dialog > div.greet-boss-container > div.greet-boss-footer > a.default-btn.sure-btn',
  chatInput: '#chat-input',
  chatSendButton: '#container > div > div > div.chat-conversation > div.message-controls > div > div:nth-child(2) > div.chat-op > button',
  jobListContainer: '.job-list-container', 
  // 扩展jobListItems选择器以适应不同页面结构
  jobListItems: [
    // 精确选择器
    '.job-list-container .job-card-wrap', 
    '.job-list-container .card-area',
    // 更多备选选择器
    '.job-list-container li', 
    '.job-list-container > ul > div',
    '.job-recommend-result .job-list-container > ul > div',
    // 最宽松的选择器
    'ul div.card-area',
    '.job-card-wrapper'
  ],
  // 扩展标题链接的选择器
  nextJobTitleLink: [
    '.job-info a', 
    '.job-title',
    // 更多通用选择器
    'a.job-name',
    'div.job-info h4 a',
    'div.job-title a'
  ],
  // 新增: 标签页选择器
  recommendTab: '#wrap > div.page-jobs-main > div.expect-and-search > div > div.c-expect-select > a.synthesis',
  jobTabs: [
    // 主选择器 - 精确定位自定义标签区域
    '#wrap > div.page-jobs-main > div.expect-and-search > div > div.c-expect-select > div.expect-list.has-add.no-part > a.expect-item',
    // 备用 - 宽松的选择器
    '.c-expect-select .expect-list a.expect-item',
    '.expect-list a.expect-item',
    // 最宽松的选择器
    '.expect-list a'
  ],
  jobTabTexts: [
    '#wrap > div.page-jobs-main > div.expect-and-search > div > div.c-expect-select > div.expect-list.has-add.no-part > a > span',
    '.expect-list a span'
  ]
};

// --- 辅助函数 (修改为支持多选择器) ---
function getTextContent(selector) {
  // 判断是数组还是单一选择器
  if (Array.isArray(selector)) {
    // 尝试多个选择器
    for (const singleSelector of selector) {
      const element = document.querySelector(singleSelector);
      if (element) {
        console.log(`[getTextContent] Found element using selector: ${singleSelector}`);
        return extractTextFromElement(element);
      }
    }
    console.warn(`[getTextContent] No element found for any of the selectors: ${selector.join(', ')}`);
    return null;
  } else {
    // 单一选择器
    const element = document.querySelector(selector);
    if (!element) {
      console.warn(`[getTextContent] Element not found for selector: ${selector}`);
      return null;
    }
    return extractTextFromElement(element);
  }
}

// 从元素提取文本的辅助函数
function extractTextFromElement(element) {
  let visibleText = '';
  // 遍历所有子节点
  element.childNodes.forEach(node => {
    // 如果是文本节点，直接添加内容
    if (node.nodeType === Node.TEXT_NODE) {
      visibleText += node.textContent;
    } 
    // 如果是元素节点，可以根据需要处理
  });
  // 清理多余的空白字符
  return visibleText.replace(/\s+/g, ' ').trim();
}

function getRandomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// 模拟点击，增加健壮性，支持多选择器
async function safeClick(selector) {
  // 处理选择器数组情况
  if (Array.isArray(selector)) {
    console.log(`Attempting to find element using multiple selectors: ${selector.join(', ')}`);
    
    // 尝试每一个选择器
    for (const singleSelector of selector) {
      const element = document.querySelector(singleSelector);
      if (element && typeof element.click === 'function') {
        console.log(`Element found using selector: ${singleSelector}. Attempting to click.`);
        element.click();
        // 减少点击后的等待时间
        await new Promise(resolve => setTimeout(resolve, getRandomDelay(ACTION_DELAY_MIN / 4, ACTION_DELAY_MAX / 4))); // 减少等待时间
        return true;
      }
    }
    
    console.error(`No clickable element found for any of the selectors: ${selector.join(', ')}`);
    return false;
  } 
  // 处理单一选择器情况
  else {
    console.log(`Attempting to find element: ${selector}`);
    const element = document.querySelector(selector);
    if (element && typeof element.click === 'function') {
      console.log(`Element found. Attempting to click: ${selector}`);
      element.click();
      // 减少点击后的等待时间
      await new Promise(resolve => setTimeout(resolve, getRandomDelay(ACTION_DELAY_MIN / 4, ACTION_DELAY_MAX / 4))); // 减少等待时间
      return true;
    } else {
      console.error(`Element not found or not clickable: ${selector}`);
      return false;
    }
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
    
    // 减少打字的间隔时间，但不要完全消除，保持一些真实性
    await new Promise(resolve => setTimeout(resolve, getRandomDelay(2, 8))); // 从5-15减少到2-8
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
  return result[STATE_KEY] || { 
    status: 'IDLE', 
    totalCount: 0, 
    processedCount: 0, 
    currentJobIndex: -1, 
    lastProcessedJobIndex: -1,
    targetTabIndex: -1 // 默认为-1，表示推荐标签页
  }; // 默认状态
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
      // 减少填充后的等待时间
      await new Promise(resolve => setTimeout(resolve, getRandomDelay(200, 400))); // 从500-1000减少到200-400
      
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
         
         // 更新状态：标记当前职位处理完成，但保留lastProcessedJobIndex
         state.processedCount += 1;
         state.status = 'MESSAGE_SENT_GOING_BACK';
         state.greetingToSend = null;
         state.currentProcessingJobDetails = null; // 清理已发送的数据
         // 不要清除 lastProcessedJobIndex，保留它用于下次选择下一个职位
         await updateState(state);
         
         // 发送成功后，自动返回上一页 (职位列表页) - 在发送消息之后执行！
         console.log("Navigating back to job list page...");
         // 减少返回前的等待时间
         await new Promise(resolve => setTimeout(resolve, getRandomDelay(ACTION_DELAY_MIN / 4, ACTION_DELAY_MAX / 4))); // 减少等待时间
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

// 新增: 切换到指定标签页的函数
async function switchToTargetTab(tabIndex) {
  // 检查tabIndex值的格式
  console.log(`switchToTargetTab被调用，参数tabIndex=${tabIndex}, 类型=${typeof tabIndex}`);
  
  // 确保tabIndex是数字
  tabIndex = parseInt(tabIndex, 10);
  console.log(`转换后的tabIndex=${tabIndex}`);
  
  // 如果是推荐标签页（值为-1），则切换到推荐tab
  if (tabIndex === -1) {
    console.log("目标为推荐标签页，尝试切换到推荐标签");
    
    // 首先检查是否已在推荐标签页
    // 检查推荐tab是否具有活跃状态的类(通常是synthesis cur)
    const recommendTab = document.querySelector(SELECTORS.recommendTab);
    if (!recommendTab) {
      console.error("未找到推荐标签页元素");
      return false;
    }
    
    console.log(`找到推荐标签页: "${recommendTab.textContent.trim()}" (class="${recommendTab.className}")`);
    
    // 检查推荐tab是否已经是活跃状态
    if (recommendTab.classList.contains('cur') || recommendTab.classList.contains('active')) {
      console.log("已经在推荐标签页，无需切换");
      return true;
    }
    
    // 需要切换到推荐标签页
    console.log("尝试点击推荐标签页...");
    recommendTab.click();
    
    // 等待页面更新
    console.log("等待推荐标签页切换完成...");
    await new Promise(resolve => setTimeout(resolve, TAB_SWITCH_DELAY));
    
    // 检查是否成功切换
    if (recommendTab.classList.contains('cur') || recommendTab.classList.contains('active')) {
      console.log("成功切换到推荐标签页");
      return true;
    } else {
      // 再次尝试点击
      console.log("推荐标签页切换可能未成功，再次尝试...");
      recommendTab.click();
      await new Promise(resolve => setTimeout(resolve, TAB_SWITCH_DELAY));
      
      if (recommendTab.classList.contains('cur') || recommendTab.classList.contains('active')) {
        console.log("第二次尝试切换到推荐标签页成功");
        return true;
      } else {
        console.warn("切换到推荐标签页失败");
        return false;
      }
    }
  }
  
  // 处理自定义标签页
  console.log(`尝试切换到第${tabIndex + 1}个自定义岗位标签...`);
  
  // 记录实际索引值
  console.log(`当前tabIndex值: ${tabIndex}, 类型: ${typeof tabIndex}`);
  
  // 直接使用精确选择器定位标签页元素
  let directSelector = "";
  if (tabIndex === 0) {
    console.log("目标是第一个自定义标签页，使用直接定位");
    directSelector = '#wrap > div.page-jobs-main > div.expect-and-search > div > div.c-expect-select > div.expect-list.has-add.no-part > a:nth-child(1)';
  } else if (tabIndex === 1) {
    directSelector = '#wrap > div.page-jobs-main > div.expect-and-search > div > div.c-expect-select > div.expect-list.has-add.no-part > a:nth-child(2)';
  } else if (tabIndex === 2) {
    directSelector = '#wrap > div.page-jobs-main > div.expect-and-search > div > div.c-expect-select > div.expect-list.has-add.no-part > a:nth-child(3)';
  }
  
  // 如果有精确选择器，优先使用
  let targetTab = null;
  if (directSelector) {
    console.log(`尝试使用精确选择器: ${directSelector}`);
    targetTab = document.querySelector(directSelector);
    if (targetTab) {
      console.log(`找到标签页元素，文本: "${targetTab.textContent.trim()}"`);
    }
  }
  
  // 如果直接选择器失败，尝试通过列表索引获取
  if (!targetTab) {
    console.log("精确选择器未找到元素，尝试通过列表获取...");
    
    // 获取所有自定义标签页
    let tabElements = null;
    for (const selector of SELECTORS.jobTabs) {
      const tabs = document.querySelectorAll(selector);
      if (tabs && tabs.length > 0) {
        console.log(`找到${tabs.length}个自定义标签页，使用选择器: ${selector}`);
        tabElements = tabs;
        break;
      }
    }
    
    if (!tabElements || tabElements.length === 0) {
      console.error("未找到任何自定义标签页元素，无法切换");
      console.log("调试信息 - 页面上的标签元素:");
      document.querySelectorAll('a').forEach(a => {
        if (a.textContent && a.textContent.trim().length > 0 && !a.href.includes('javascript:void') && a.offsetParent !== null) {
          console.log(`可能的标签: "${a.textContent.trim()}" (class="${a.className}")`);
        }
      });
      return false;
    }
    
    console.log(`找到${tabElements.length}个自定义标签页：`);
    for (let i = 0; i < tabElements.length; i++) {
      const text = tabElements[i].textContent.trim();
      console.log(`  ${i}: "${text}" (class="${tabElements[i].className}")`);
    }
    
    // 确保索引在有效范围内
    if (tabIndex >= tabElements.length) {
      console.warn(`指定的标签页索引 ${tabIndex} 超出范围，最大索引为 ${tabElements.length - 1}`);
      tabIndex = tabElements.length - 1; // 使用最后一个标签页
    }
    
    // 获取目标标签页
    targetTab = tabElements[tabIndex];
  }
  
  if (!targetTab) {
    console.error(`无法获取索引为 ${tabIndex} 的标签页元素`);
    return false;
  }
  
  // 记录要切换到的标签页文本，用于日志
  let tabText = targetTab.textContent.trim();
  console.log(`目标标签页: "${tabText}" (索引: ${tabIndex})`);
  
  // 如果已经在目标标签页，则不需要切换
  if (targetTab.classList.contains('cur') || targetTab.classList.contains('active')) {
    console.log(`已经在目标标签页 "${tabText}" 中，无需切换`);
    return true;
  }
  
  // 针对第一个标签页尝试直接激活
  if (tabIndex === 0) {
    console.log(`==== 使用第一个标签页的特殊处理 ====`);
    
    try {
      // 找到标签页表
      let tabContainer = targetTab.parentElement;
      if (tabContainer && tabContainer.classList.contains('expect-list')) {
        console.log(`找到标签容器: ${tabContainer.className}`);
        
        // 首先尝试简单点击
        console.log("尝试方法1: 直接点击");
        targetTab.click();
        
        await new Promise(resolve => setTimeout(resolve, TAB_SWITCH_DELAY));
        
        if (targetTab.classList.contains('cur') || targetTab.classList.contains('active')) {
          console.log("方法1成功!");
          return true;
        }
        
        // 尝试2: 点击子元素
        console.log("尝试方法2: 点击span子元素");
        const span = targetTab.querySelector('span');
        if (span) {
          console.log(`找到span元素: "${span.textContent.trim()}"`);
          span.click();
          
          await new Promise(resolve => setTimeout(resolve, TAB_SWITCH_DELAY));
          
          if (targetTab.classList.contains('cur') || targetTab.classList.contains('active')) {
            console.log("方法2成功!");
            return true;
          }
        }
        
        // 尝试3: 模拟完整点击事件序列
        console.log("尝试方法3: 模拟完整点击事件序列");
        
        // 先创建MouseDown事件
        targetTab.dispatchEvent(new MouseEvent('mousedown', {
          bubbles: true,
          cancelable: true,
          view: window
        }));
        
        // 短暂延迟
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // 创建MouseUp事件
        targetTab.dispatchEvent(new MouseEvent('mouseup', {
          bubbles: true,
          cancelable: true,
          view: window
        }));
        
        // 然后创建Click事件
        targetTab.dispatchEvent(new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window
        }));
        
        // 等待页面响应
        await new Promise(resolve => setTimeout(resolve, TAB_SWITCH_DELAY));
        
        if (targetTab.classList.contains('cur') || targetTab.classList.contains('active')) {
          console.log("方法3成功!");
          return true;
        }
        
        // 最后尝试: 强制添加类名
        console.log("尝试方法4: 强制修改DOM");
        
        // 移除容器内所有标签的激活状态
        Array.from(tabContainer.querySelectorAll('a')).forEach(tab => {
          tab.classList.remove('cur');
          tab.classList.remove('active');
        });
        
        // 为目标标签添加激活类
        targetTab.classList.add('cur');
        
        console.log("已为第一个标签页强制添加cur类");
        
        // 手动触发点击事件，让页面内容更新
        targetTab.click();
        
        return true;
      } else {
        console.warn("未找到标签容器");
      }
    } catch(err) {
      console.error("处理第一个标签页时出错:", err);
    }
    
    // 最终回退：强制类名修改
    console.log("执行回退方案: 强制类名");
    targetTab.classList.add('cur');
    targetTab.click();
    return true;
  }
  
  // 常规标签页处理
  console.log(`点击标签页元素...`);
  targetTab.click();
  
  // 等待页面更新
  console.log("等待标签页切换完成...");
  await new Promise(resolve => setTimeout(resolve, TAB_SWITCH_DELAY));
  
  // 检查是否成功切换
  if (targetTab.classList.contains('cur') || targetTab.classList.contains('active')) {
    console.log(`切换成功！当前标签页: "${tabText}"`);
    return true;
  } else {
    // 再次尝试点击
    console.log("标签页切换可能未成功，再次尝试...");
    targetTab.click();
    await new Promise(resolve => setTimeout(resolve, TAB_SWITCH_DELAY));
    
    if (targetTab.classList.contains('cur') || targetTab.classList.contains('active')) {
      console.log(`第二次尝试切换成功！当前标签页: "${tabText}"`);
      return true;
    } else {
      console.warn(`标签页切换失败，请手动切换到 "${tabText}"`);
      return false;
    }
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
     await updateState(state); // 明确保存状态
     console.log("状态已保存为 LOOKING_FOR_NEXT_JOB，现在继续处理下一个职位");
     // 已明确保存状态，下面的逻辑会处理新状态
  }

  // 检查状态是否应该处理 (LOOKING_FOR_NEXT_JOB)
  if (state.status === 'LOOKING_FOR_NEXT_JOB') {
    console.log(`[Check Next Job] Status is LOOKING_FOR_NEXT_JOB. Processed: ${state.processedCount}, Total: ${state.totalCount}`);

    // 检查是否还有剩余任务
    if (state.processedCount < state.totalCount) {
      // 新增: 在处理前检查是否需要切换标签页
      if (state.targetTabIndex !== undefined) {
        console.log(`尝试切换到配置的标签页(索引: ${state.targetTabIndex})...`);
        const tabSwitchSuccess = await switchToTargetTab(state.targetTabIndex);
        
        if (!tabSwitchSuccess) {
          console.warn("标签页切换失败，但将继续尝试处理职位");
        }
      }
      
      console.log("尝试处理当前页面上显示的职位...");
      
      // 获取列表中所有职位条目
      let jobItems = null;
      // 尝试所有可能的job列表项选择器
      for (const selector of SELECTORS.jobListItems) {
        const items = document.querySelectorAll(selector);
        if (items && items.length > 0) {
          console.log(`找到${items.length}个职位条目使用选择器: ${selector}`);
          jobItems = items;
          break;
        }
      }
      
      if (!jobItems || jobItems.length === 0) {
        console.error("找不到任何职位条目，可能页面结构已改变。");
        alert("未能在此页面上找到职位列表项，请确认页面是否正确加载。流程停止。");
        await clearState();
        return;
      }
      
      // 确定要处理的职位索引
      let nextJobIndex = 0;
      
      // 如果有上一次处理记录，选择下一个职位
      if (state.lastProcessedJobIndex !== undefined && state.lastProcessedJobIndex >= 0) {
        nextJobIndex = (state.lastProcessedJobIndex + 1) % jobItems.length;
        console.log(`上次处理了第${state.lastProcessedJobIndex}个职位，现在将处理第${nextJobIndex}个职位`);
      } else {
        console.log(`没有找到上次处理记录，将从第${nextJobIndex}个职位开始处理`);
      }
      
      // 确保索引在有效范围内
      if (nextJobIndex >= jobItems.length) {
        nextJobIndex = 0;
        console.log(`索引超出范围，重置为第${nextJobIndex}个职位`);
      }
      
      // 找到要处理的职位卡片
      const jobToClick = jobItems[nextJobIndex];
      if (!jobToClick) {
        console.error(`未能找到索引${nextJobIndex}的职位条目`);
        alert(`未能找到要处理的职位条目，流程停止。`);
        await clearState();
        return;
      }
      
      console.log(`准备处理第${nextJobIndex}个职位条目...`);

      // *** 关键改动：在点击前先从卡片提取信息 ***
      // 从职位卡片中直接提取标题和公司名
      let jobTitleFromCard = null;
      let companyNameFromCard = null;
      
      try {
          // 尝试从卡片中提取职位标题
          const titleSelectors = [
              ...SELECTORS.nextJobTitleLink, // 使用已定义的选择器
              '.job-info a', // 通用选择器
              '.job-name', // 通用选择器
              'div.job-title a', 
              '.job-card a[title]', // 带有title属性的链接
              'a[data-seo="job-name"]', // 数据属性
              'a.job-title', // 类名匹配
              // 更宽松的选择器
              'a[href*="job"]', // 链接中包含"job"的元素
              'h3 a', // 标题中的链接
              'h4 a'  // 标题中的链接
          ];
          
          for (const selector of titleSelectors) {
              try {
                  const elements = jobToClick.querySelectorAll(selector);
                  if (elements && elements.length > 0) {
                      for (const element of elements) {
                          if (element) {
                              const text = extractTextFromElement(element);
                              if (text && text.length > 0) {
                                  jobTitleFromCard = text;
                                  console.log(`从卡片中提取到职位标题: "${jobTitleFromCard}" 使用选择器: ${selector}`);
                                  break;
                              }
                          }
                      }
                      if (jobTitleFromCard) break;
                  }
              } catch(e) {
                  console.warn(`尝试职位标题选择器 ${selector} 时出错:`, e);
              }
          }
          
          // 尝试从卡片中提取公司名称
          const companySelectors = [
              '.job-card-footer a span', // 通用选择器
              '.company-name',  // 通用选择器
              'a.company-name', // 另一种可能的结构
              '.job-company',   // 另一种可能的结构
              '.job-card-right a.company-name', 
              'div.company-name',
              '.job-footer .company',
              // 更宽松的选择器
              '[class*="company"]', // 类名包含"company"的元素
              '.job-card-footer a' // 底部区域的链接
          ];
          
          for (const selector of companySelectors) {
              try {
                  const elements = jobToClick.querySelectorAll(selector);
                  if (elements && elements.length > 0) {
                      for (const element of elements) {
                          if (element) {
                              const text = extractTextFromElement(element);
                              if (text && text.length > 0) {
                                  companyNameFromCard = text;
                                  console.log(`从卡片中提取到公司名称: "${companyNameFromCard}" 使用选择器: ${selector}`);
                                  break;
                              }
                          }
                      }
                      if (companyNameFromCard) break;
                  }
              } catch(e) {
                  console.warn(`尝试公司名称选择器 ${selector} 时出错:`, e);
              }
          }
          
          // 备用方案：从卡片的文本节点获取更多信息
          if (!jobTitleFromCard || !companyNameFromCard) {
              console.log("尝试备用方法：从卡片的全部文本内容中提取信息...");
              const allText = extractTextFromElement(jobToClick);
              console.log("卡片全部文本内容:", allText);
              
              if (allText) {
                  // 尝试提取文本中的第一行作为可能的职位名称
                  if (!jobTitleFromCard) {
                      const lines = allText.split(/[\n\r]/);
                      for (const line of lines) {
                          const trimmed = line.trim();
                          if (trimmed && trimmed.length > 0 && trimmed.length < 50) { // 合理的职位名称长度
                              jobTitleFromCard = trimmed;
                              console.log("从卡片文本提取到可能的职位标题:", jobTitleFromCard);
                              break;
                          }
                      }
                  }
              }
          }
      } catch (e) {
          console.error("从卡片提取信息时发生错误:", e);
      }
      
      // 记录提取到的信息
      if (jobTitleFromCard && companyNameFromCard) {
          console.log(`成功从卡片中提取到职位信息:
          - 标题: ${jobTitleFromCard}
          - 公司: ${companyNameFromCard}`);
          
          // 保存到状态中，以便后续使用
          state.cardJobInfo = {
              jobTitle: jobTitleFromCard,
              companyName: companyNameFromCard
          };
          await updateState(state);
      } else {
          console.warn(`无法从卡片中提取完整的职位信息，标题: ${jobTitleFromCard || '无'}, 公司: ${companyNameFromCard || '无'}, 将在详情页尝试提取`);
      }
      
      // 更新状态，记录当前要处理的职位索引
      state.currentJobIndex = nextJobIndex;
      state.lastProcessedJobIndex = nextJobIndex; // 保存这次将要处理的索引，下次返回时跳到下一个
      state.status = 'PROCESSING_JOB_INDEX';
      await updateState(state);
      console.log(`状态已更新，准备处理列表中的第${state.currentJobIndex}个职位`);
      
      // 尝试查找并点击职位标题链接
      let titleLink = null;
      for (const selector of SELECTORS.nextJobTitleLink) {
        titleLink = jobToClick.querySelector(selector);
        if (titleLink) {
          console.log(`找到标题链接使用选择器: ${selector}`);
          break;
        }
      }
      
      if (titleLink && typeof titleLink.click === 'function') {
        console.log(`点击第${nextJobIndex}个职位的标题链接...`);
        titleLink.click();
        
        // 等待职位详情加载
        console.log("等待职位详情完全加载...");
        await new Promise(resolve => setTimeout(resolve, NEXT_JOB_CLICK_DELAY));
        
        // 更新状态为处理职位详情
        state.status = 'PROCESSING_JOB_DETAILS';
        await updateState(state);
        
        // 调用函数处理职位详情
        await processCurrentJobDetails();
      } else {
        console.error(`未能在第${nextJobIndex}个职位条目中找到可点击的标题链接`);
        alert(`未能点击选中的职位，请检查页面结构或联系技术支持。流程停止。`);
        await clearState();
      }

    } else {
      // 所有指定数量的职位都处理完了
      console.log("All jobs processed!");
      alert(`任务完成！成功处理了 ${state.processedCount} 个职位。`);
      await clearState(); // 清理状态
    }
  } else if (state.status === 'PROCESSING_JOB_INDEX') {
    // 如果处于PROCESSING_JOB_INDEX状态，可能是页面刷新导致，尝试恢复流程
    console.log(`处于PROCESSING_JOB_INDEX状态，尝试恢复流程...`);
    state.status = 'LOOKING_FOR_NEXT_JOB';
    await updateState(state);
    // 递归调用自身继续处理
    await checkAndProcessNextJob();
  } else if (state.status === 'IDLE') {
      console.log("[Check Next Job] On list page, but status is IDLE. Doing nothing.");
  } else {
      // 捕获其他未预料到的状态
      console.warn(`[Check Next Job] On list page, but found unexpected state '${state.status}'. Clearing state.`);
      alert(`在列表页面检测到意外的流程状态 (${state.status})，已重置。`);
      await clearState();
  }
}

// 处理当前选中的职位详情
async function processCurrentJobDetails() {
    let state = await getState(); 
    if (state.status !== 'PROCESSING_JOB_DETAILS') {
        console.warn("Called processCurrentJobDetails with incorrect state:", state.status);
        return; 
    }

    console.log(`Processing details for job index: ${state.currentJobIndex}. Using multi-selector approach.`);
    
    // 添加额外延迟，确保详情页面完全加载
    console.log("Waiting for job details page to fully load...");
    await new Promise(resolve => setTimeout(resolve, JOB_DETAIL_LOAD_DELAY));
    
    // 重新检查是否在职位详情页
    const jobDetailContainer = document.querySelector('.job-detail-container, .job-box, .job-detail');
    if (!jobDetailContainer) {
        console.error("Not on a job detail page or job detail container not found");
        alert("未能找到职位详情页面元素，无法提取职位信息。流程停止。");
        await clearState();
        return;
    }

    // 职位信息提取的重试器
    let jobTitle = null;
    let companyName = null;
    let jobDescription = "";
    let retryCount = 0;
    
    // 重试机制：如果提取失败，尝试多次
    while (retryCount < MAX_INFO_EXTRACT_RETRIES) {
        console.log(`尝试提取职位信息 (第${retryCount + 1}次尝试)...`);
        
        // 主要提取职位描述内容
        if (!jobDescription && jobDetailContainer) {
            const descSelectors = [
                '.job-sec .text', 
                '.job-description .text', 
                '.job-box .text', 
                'p.desc', 
                '.detail-content',
                '.job-detail .detail-content',
                '.detail-section .text'
            ];
            for (const selector of descSelectors) {
                const descElement = jobDetailContainer.querySelector(selector);
                if (descElement && descElement.offsetParent !== null) { 
                    jobDescription = extractTextFromElement(descElement);
                    console.log(`[Debug] Found job description (${jobDescription.length} chars) using selector: ${selector}`);
                    break;
                }
            }
        }
        
        if (!jobDescription && jobDetailContainer && jobDetailContainer.offsetParent !== null) { 
            jobDescription = extractTextFromElement(jobDetailContainer);
            console.log(`[Debug] Extracted fallback description directly from container (${jobDescription.length} chars)`);
        }
        
        // 从卡片信息中获取标题和公司名，而不是从详情页提取
        jobTitle = state.cardJobInfo?.jobTitle;
        companyName = state.cardJobInfo?.companyName;
        
        // 备用：如果没有从卡片获取到，尝试从详情页面获取
        if (!jobTitle || !companyName) {
            console.log("卡片中未提取到完整信息，尝试从详情页面获取...");
            
            // 尝试从详情页获取职位标题
            if (!jobTitle) {
                const detailTitleSelectors = [
                    '.job-detail-header .title',
                    '.job-detail-box .title',
                    '.job-detail-container h3',
                    'h3.title',
                    '.job-box .job-name',
                    '.job-header .title',
                    '.job-detail h3',
                    'h1.job-title',
                    '.job-name',
                    // 更宽松的选择器
                    '.job-detail-container h1, .job-detail-container h2, .job-detail-container h3'
                ];
                
                for (const selector of detailTitleSelectors) {
                    try {
                        const elements = document.querySelectorAll(selector);
                        for (const element of elements) {
                            if (element && element.offsetParent !== null) {
                                const text = extractTextFromElement(element);
                                if (text && text.length > 0 && !text.includes("职位描述")) {
                                    jobTitle = text;
                                    console.log(`从详情页提取到职位标题: "${jobTitle}" (使用选择器: ${selector})`);
                                    break;
                                }
                            }
                        }
                        if (jobTitle) break;
                    } catch(e) {
                        console.warn(`尝试选择器 ${selector} 时出错:`, e);
                    }
                }
            }
            
            // 尝试从详情页获取公司名称
            if (!companyName) {
                const detailCompanySelectors = [
                    '.job-detail-header .company-name',
                    '.job-detail-box .company-name',
                    '.job-detail-container .company-logo-wrapper + div',
                    'span.company-name',
                    '.job-box .job-company-info',
                    '.company-name',
                    '.job-company',
                    '.job-card-footer a span',
                    // 更宽松的选择器
                    '[class*="company"]'
                ];
                
                for (const selector of detailCompanySelectors) {
                    try {
                        const elements = document.querySelectorAll(selector);
                        for (const element of elements) {
                            if (element && element.offsetParent !== null) {
                                const text = extractTextFromElement(element);
                                if (text && text.length > 0) {
                                    companyName = text;
                                    console.log(`从详情页提取到公司名称: "${companyName}" (使用选择器: ${selector})`);
                                    break;
                                }
                            }
                        }
                        if (companyName) break;
                    } catch(e) {
                        console.warn(`尝试选择器 ${selector} 时出错:`, e);
                    }
                }
            }
        }
        
        // 检查信息是否已提取成功
        if (jobTitle && companyName) {
            console.log(`成功提取职位信息 (第${retryCount + 1}次尝试)!`);
            break; // 提取成功，跳出重试循环
        }
        
        // 如果没提取到，等待并重试
        retryCount++;
        if (retryCount < MAX_INFO_EXTRACT_RETRIES) {
            console.log(`未能提取完整信息，等待后将进行第${retryCount + 1}次尝试...`);
            // 每次重试前多等待一些时间，页面可能需要更长时间加载
            await new Promise(resolve => setTimeout(resolve, JOB_DETAIL_LOAD_DELAY));
        }
    }
    
    const jobDetails = {
        jobTitle: jobTitle,
        companyName: companyName,
        jobDescription: jobDescription || "[描述提取失败]",
        jobRequirements: ""
    };
    
    console.log("Extracted job details:", jobDetails);

    // 检查提取结果
    if (!jobDetails.jobTitle || !jobDetails.companyName) {
        console.error("Failed to extract essential job details (Title or Company Name) after multiple attempts... stopping.", 
                     "Title found:", jobDetails.jobTitle, "Company found:", jobDetails.companyName);
        alert(`多次尝试后仍未能提取到当前选中职位的关键信息。\n找到的标题: ${jobDetails.jobTitle || '无'}\n找到的公司: ${jobDetails.companyName || '无'}\n请刷新页面后重试或联系技术支持。流程停止。`);
        await clearState();
        return;
    }
    
    console.log("Successfully extracted job details:", jobDetails);

    state.currentProcessingJobDetails = jobDetails; // 将提取到的信息存入 state

    // 发送给 Background
    console.log("Sending job details to background script...");
    try {
      // 确认发送的是 jobDetails 对象
      console.log("[Debug] Sending the following jobDetails object:", JSON.stringify(jobDetails));
      const response = await chrome.runtime.sendMessage({ action: "processJobPage", details: jobDetails });
      console.log("Received response from background:", response);

      if (response && response.success && response.greeting) {
        const greetingToSend = response.greeting;
        console.log("Greeting received:", greetingToSend);

              // 3. 更新状态和消息，准备跳转到聊天页面
              state.status = 'WAITING_TO_SEND_ON_CHAT_PAGE';
              state.greetingToSend = greetingToSend;
              await updateState(state); 
              console.log("State updated (incl. job details). Ready to navigate to chat page.", state);

              // 4. 点击"立即沟通" 
              console.log("Attempting step 4: Click Start Chat Button using selector:", SELECTORS.startChatButton);
        if (await safeClick(SELECTORS.startChatButton)) {
          // 5. 等待并点击弹窗中的"继续沟通"
          console.log("Start chat button clicked successfully. Waiting for popup...");
                  // 使用更长的等待时间确保弹窗完全显示
                  await new Promise(resolve => setTimeout(resolve, POPUP_APPEAR_DELAY));
                  console.log("Attempting step 5: Click Continue Chat Button in Popup using selector:", SELECTORS.continueChatButtonPopup);
          
          // 尝试点击"继续沟通"按钮
          let continueChatClicked = await safeClick(SELECTORS.continueChatButtonPopup);
          
          // 如果第一次点击失败，等待额外的时间后再尝试一次
          if (!continueChatClicked) {
            console.log("First attempt to click continue chat button failed. Waiting longer and trying again...");
            await new Promise(resolve => setTimeout(resolve, POPUP_APPEAR_DELAY));
            continueChatClicked = await safeClick(SELECTORS.continueChatButtonPopup);
          }
          
          if (continueChatClicked) {
                      console.log("Clicked continue in popup. Navigation to chat page should occur.");
                      // 页面即将跳转
          } else {
                      console.error("Failed to click continue button in popup after retries. Stopping.");
                      alert("未能点击弹窗中的'继续沟通'按钮，流程停止。");
                      await clearState();
          }
        } else {
                    console.error("Failed to click start chat button using selector. Stopping.");
                    // 提示用户检查 startChatButton 选择器
                    alert(`未能找到或点击'立即沟通'按钮 (Selector: ${SELECTORS.startChatButton})，页面结构可能已改变。流程停止。`);
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
        currentJobIndex: -1, // 初始索引为-1
        lastProcessedJobIndex: -1, // 添加这个字段来跟踪上次处理的索引
        targetTabIndex: request.targetTabIndex || -1, // 目标标签页索引，默认为推荐标签页
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
    
    // --- 减少初始等待时间 ---
    await new Promise(resolve => setTimeout(resolve, 400)); // 从800减少到400

    // 检查是否在官网并获取token
    checkForTokenOnWebsite();

    const state = await getState();
    console.log("Initial state on load:", state);

    // 再次确认修改点: 放宽聊天页面的 URL 检查
    const isOnChatPage = window.location.href.includes('/chat/im?') || window.location.href.includes('/web/geek/chat');

    // *** 修改点：扩展列表页 URL 检查，并增加元素查找重试 ***
    let isOnListPage = false;
    const listPageURLs = ['/web/geek/job-recommend', '/web/geek/jobs']; // 包含 /jobs
    const isOnListPageByURL = listPageURLs.some(urlPart => window.location.href.includes(urlPart));

    if (isOnListPageByURL) {
        // 如果 URL 匹配，尝试查找列表容器，给它一点时间加载
        console.log("URL matches potential list page. Checking for list container element...");
        let attempts = 0;
        const maxAttempts = 5; // 最多尝试5次
        const retryDelay = 300; // 每次间隔300ms - 从500减少到300
        while (attempts < maxAttempts && !isOnListPage) {
            const hasListContainer = document.querySelector(SELECTORS.jobListContainer);
            if (hasListContainer) {
                console.log(`List container found after ${attempts + 1} attempt(s).`);
                isOnListPage = true;
            } else {
                attempts++;
                console.log(`List container not found (attempt ${attempts}/${maxAttempts}). Retrying in ${retryDelay}ms...`);
                if (attempts < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                }
            }
        }
        if (!isOnListPage) {
             console.warn("URL matched list page, but list container element could not be found after multiple attempts.");
        }
    } else {
        // 如果 URL 都不匹配，才考虑单独检查元素 (作为后备，可能性不大)
        const hasListContainer = document.querySelector(SELECTORS.jobListContainer);
        if (hasListContainer) {
             console.log("URL didn't match, but list container element was found. Treating as list page.");
             isOnListPage = true;
        }
    }
    // *** 结束修改点 ***


    if (isOnChatPage) {
        console.log("On chat page, checking for pending send...");
        await checkAndPerformPendingSend(); // 在聊天页检查是否要发送
    } else if (isOnListPage) {
        console.log("On job list/recommend page, checking for next job action...");
        await checkAndProcessNextJob(); // 在列表页检查是否要处理下一个
    } else {
        console.log("Not on a recognized page for automated actions (chat or list/recommend/jobs). Current URL:", window.location.href);
        // 如果状态异常但不在已知页面，清理状态
        if (state.status !== 'IDLE') {
           console.warn(`Script initialized on an unrecognized page (${window.location.href}) with active state: ${state.status}. Clearing state.`);
           // 保留 alert 方便用户感知问题，但可以考虑只在开发模式下提示
           alert(`脚本在非预期的页面 (${window.location.href}) 加载，但存在未完成的任务状态，已重置。如果您认为这是列表页，请联系技术支持更新页面识别规则。`);
           await clearState();
        }
    }
}

initializeScript(); 