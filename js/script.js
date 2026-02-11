/**
 * PsycheFit - 核心逻辑脚本 (二维坐标版)
 * 依赖: data.js (必须包含 questions 和 attachmentDetails)
 */

// ---------------------------------------------------------
// 全局状态管理
// ---------------------------------------------------------
let currentQuestion = 0;
let answers = []; // 存储用户的选择索引
let testStartTime = null;
let loadingInterval = null;

// DOM 元素获取简写 (辅助函数)
const getEl = (id) => document.getElementById(id);

// ---------------------------------------------------------
// 核心逻辑：计分算法与归一化
// ---------------------------------------------------------
function calculateFinalResults() {
    let totalAx = 0;
    let totalAv = 0;
    const count = questions.length;

    // 1. 累加得分
    answers.forEach((optionIndex, questionIndex) => {
        const question = questions[questionIndex];
        if (question && question.options[optionIndex]) {
            const score = question.options[optionIndex].scores;
            totalAx += score.ax;
            totalAv += score.av;
        }
    });

    // 2. 计算平均分 (-1.0 到 1.0)
    let avgAx = totalAx / count;
    let avgAv = totalAv / count;

    // 3. 归一化 -> 映射到 0-100%
    let percentAx = ((avgAx + 1) / 2) * 100;
    let percentAv = ((avgAv + 1) / 2) * 100;

    // --- 微量随机偏移 (Jitter) ---
    const addJitter = (val) => {
        let jitter = (Math.random() - 0.5) * 3; 
        if (Math.abs(val - 50) < 2) {
            const push = (Math.random() > 0.5 ? 1 : -1) * (1.5 + Math.random() * 1.5);
            jitter += push;
        }
        return val + jitter;
    };

    percentAx = addJitter(percentAx);
    percentAv = addJitter(percentAv);

    // --- 【关键修改】边界限制：增加安全边距 ---
    // 将范围从 5-95 调整为 8-92，留出足够的空间给红点自身
    // 这样即使是极端分数，红点也不会切到圆圈边缘
    const safeMargin = 8; // 8% 的安全边距
    percentAx = Math.max(safeMargin, Math.min(100 - safeMargin, percentAx));
    percentAv = Math.max(safeMargin, Math.min(100 - safeMargin, percentAv));

    // 4. 判定依恋类型 (基于原始准确分数)
    let type = '';
    const threshold = 0; 

    if (avgAx <= threshold && avgAv <= threshold) {
        type = 'secure';
    } else if (avgAx > threshold && avgAv <= threshold) {
        type = 'anxious'; // 左上
    } else if (avgAx <= threshold && avgAv > threshold) {
        type = 'avoidant'; // 右下
    } else {
        type = 'fearful'; // 右上
    }

    return {
        type: type,
        coordinates: { x: avgAv, y: avgAx }, 
        visual: { x: percentAv, y: percentAx } 
    };
}

// ---------------------------------------------------------
// 页面交互逻辑
// ---------------------------------------------------------

// 切换屏幕显示
function showScreen(screenId) {
    const screens = ['welcomeScreen', 'testScreen', 'reflectionScreen', 'resultScreen'];
    screens.forEach(id => {
        const el = getEl(id);
        if (el) el.style.display = 'none';
    });
    const target = getEl(screenId);
    if (target) {
        target.style.display = screenId === 'testScreen' ? 'flex' : 'block';
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 显示 Toast 提示
function showToast(message, icon = '✓') {
    const toast = getEl('toast');
    if (toast) {
        getEl('toastMessage').textContent = message;
        getEl('toastIcon').textContent = icon;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }
}

// 显示模态框
function showModal(title, desc, onConfirm) {
    const modal = getEl('modal');
    if (modal) {
        getEl('modalTitle').textContent = title;
        getEl('modalDesc').textContent = desc;
        modal.style.display = 'flex';
        
        const confirmBtn = getEl('modalConfirm');
        // 清除旧的事件监听器，防止重复绑定
        const newBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);
        
        newBtn.onclick = () => {
            closeModal();
            if (onConfirm) onConfirm();
        };
    }
}

function closeModal() {
    const modal = getEl('modal');
    if (modal) modal.style.display = 'none';
}

function showSettings() {
    showModal('设置', '自定义你的体验。功能即将推出！', () => {});
}

// 开始测试
function startTest() {
    currentQuestion = 0;
    answers = [];
    testStartTime = Date.now();
    showScreen('testScreen');
    showQuestion();
}

// 渲染题目
function showQuestion() {
    const q = questions[currentQuestion];
    getEl('questionTitle').textContent = q.title;
    
    const optionsContainer = getEl('optionsContainer');
    optionsContainer.innerHTML = '';
    
    q.options.forEach((option, index) => {
        const optionDiv = document.createElement('div');
        optionDiv.className = 'option';
        optionDiv.textContent = option.text;
        optionDiv.onclick = () => selectOption(index);
        optionsContainer.appendChild(optionDiv);
    });

    // 更新进度条
    const progress = ((currentQuestion + 1) / questions.length) * 100;
    const progressFill = getEl('progressFill');
    if (progressFill) progressFill.style.width = progress + '%';
    
    // 更新返回按钮状态
    const backBtn = getEl('backButton');
    if(backBtn) {
        backBtn.disabled = currentQuestion === 0;
        backBtn.style.opacity = currentQuestion === 0 ? '0.4' : '1';
    }
}

// 选择选项
function selectOption(index) {
    // 记录答案
    answers[currentQuestion] = index;
    
    // 震动反馈 (如果设备支持)
    if (navigator.vibrate) navigator.vibrate(10);

    // 延迟跳转下一题，给用户一点视觉反馈时间
    setTimeout(() => {
        if (currentQuestion < questions.length - 1) {
            currentQuestion++;
            showQuestion();
        } else {
            finishTest();
        }
    }, 250);
}

// 返回上一题
function previousQuestion() {
    if (currentQuestion > 0) {
        currentQuestion--;
        showQuestion();
    }
}

// 测试结束处理
function finishTest() {
    showScreen('reflectionScreen');
    startLoadingAnimation();
    
    // 模拟分析过程 (3秒后出结果)
    setTimeout(() => {
        if (loadingInterval) clearInterval(loadingInterval);
        createConfetti(); // 撒花效果
        const results = calculateFinalResults();
        showResults(results);
    }, 3000);
}

// 加载动画逻辑
function startLoadingAnimation() {
    let progress = 0;
    const progressBar = getEl('loadingProgressBar');
    const percentageText = getEl('progressPercentage');
    
    // 重置步骤样式
    document.querySelectorAll('.progress-step').forEach(el => {
        el.classList.remove('active', 'completed');
    });
    
    const step1 = getEl('step1');
    if(step1) step1.classList.add('active');

    loadingInterval = setInterval(() => {
        progress += Math.random() * 5; // 随机增加进度
        if (progress > 100) progress = 100;
        
        if(progressBar) progressBar.style.width = progress + '%';
        if(percentageText) percentageText.textContent = Math.round(progress) + '%';

        // 简单的步骤流转动画
        if (progress > 30) {
            updateStep('step1', 'step2');
        }
        if (progress > 60) {
            updateStep('step2', 'step3');
        }
        if (progress > 90) {
            updateStep('step3', 'step4');
        }
    }, 100);
}

function updateStep(prevId, nextId) {
    const prev = getEl(prevId);
    const next = getEl(nextId);
    if (prev && next && !prev.classList.contains('completed')) {
        prev.classList.remove('active');
        prev.classList.add('completed');
        next.classList.add('active');
    }
}

// 撒花特效
function createConfetti() {
    const colors = ['#ff6b9d', '#c44569', '#ffa502', '#ff6348', '#5f27cd', '#00d2d3'];
    for (let i = 0; i < 50; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = Math.random() * window.innerWidth + 'px';
        confetti.style.top = '-10px';
        confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.animationDelay = Math.random() * 2 + 's';
        document.body.appendChild(confetti);
        setTimeout(() => confetti.remove(), 5000); // 5秒后移除DOM
    }
}

// ---------------------------------------------------------
// 结果展示逻辑 (动态生成坐标图)
// ---------------------------------------------------------
// ---------------------------------------------------------
// 结果展示逻辑 (已优化顶部横幅和底部卡片)
// ---------------------------------------------------------
function showResults(results) {
    const { type, visual, coordinates } = results;
    
    // 获取对应的文案
    const detail = attachmentDetails[type];
    if (!detail) {
        console.error("未找到对应的依恋类型详情:", type);
        return;
    }

    // 1. 顶部英雄横幅 HTML 生成
    // 根据类型选择对应的主题色类名
    const heroClassMap = {
        'secure': 'hero-secure',
        'anxious': 'hero-anxious',
        'avoidant': 'hero-avoidant',
        'fearful': 'hero-fearful'
    };
    const heroThemeClass = heroClassMap[type] || '';

    const heroHtml = `
        <div class="result-hero ${heroThemeClass}">
            <div class="result-hero-icon">🌸</div>
            <div class="result-hero-content">
                <div class="result-hero-subtitle">你的依恋风格是</div>
                <div class="result-offer-badge">🔥 今日限时：行动包直发</div>
                <h1 class="result-hero-title">${detail.name}</h1>
                <div class="attachment-badge ${detail.badge}">${detail.badgeText}</div>
            </div>
        </div>
    `;
    
    // 2. 中间坐标图 HTML 生成 (保持不变)
    const graphHtml = `
        <div class="result-graph-card">
            <div class="graph-container">
                <div class="quadrant q-anxious"></div>
                <div class="quadrant q-fearful"></div>
                <div class="quadrant q-secure"></div>
                <div class="quadrant q-avoidant"></div>
                <div class="axis-x"></div>
                <div class="axis-y"></div>
                <div class="label-quad l-tl">焦虑型</div>
                <div class="label-quad l-tr">恐惧型</div>
                <div class="label-quad l-bl">安全型</div>
                <div class="label-quad l-br">回避型</div>
                <div class="user-dot" style="left: ${visual.x}%; bottom: ${visual.y}%;"></div>
            </div>
            <div class="graph-footer">
                <span class="coord-pill">焦虑指数: ${coordinates.y.toFixed(2)}</span>
                <span class="coord-pill">回避指数: ${coordinates.x.toFixed(2)}</span>
            </div>
        </div>
    `;

    // 3. 底部伴侣建议卡片 HTML 生成
    // 智能判断：如果 data.js 里配的是数组，就生成清单；如果是字符串，就显示段落。
    let tipsContent = '';
    if (Array.isArray(detail.partnerTips)) {
        // 如果是数组，生成易读的清单
        tipsContent = `
            <ul class="partner-tips-list">
                ${detail.partnerTips.map(tip => `
                    <li class="partner-tips-item">
                        <span class="tips-bullet">✓</span>
                        <span>${tip}</span>
                    </li>
                `).join('')}
            </ul>
        `;
    } else {
        // 如果是旧的字符串格式，提供一个默认的段落显示，防止报错
        tipsContent = `<p style="line-height:1.6; color:#4a5568;">${detail.partnerTips}</p>`;
    }

    const partnerTipsCardHtml = `
        <div class="partner-tips-card">
            <div class="partner-tips-header">
                <div class="partner-tips-icon">💡</div>
                <div class="partner-tips-title">给你的伴侣/密友</div>
            </div>
            ${tipsContent}
        </div>
    `;

    // 4. 组装最终 HTML 结构
    let html = `
        ${heroHtml}

        ${graphHtml}

        <div class="attachment-card">
            <p class="attachment-subtitle">${detail.subtitle}</p>
            <p class="result-opening-text">${detail.opening}</p>
        </div>

        <div class="scenario-mirror">
            <div class="scenario-mirror-title"><span>🪞</span><span>你的关系镜像</span></div>
            ${detail.scenarios.map(s => `
                <div class="scenario-item">
                    <div class="scenario-situation">${s.situation}</div>
                    <div class="scenario-response">${s.response}</div>
                </div>
            `).join('')}
        </div>

        <div class="relationship-impact">
            <div class="relationship-impact-title"><span>💫</span><span>深层影响</span></div>
            <p class="relationship-impact-text">${detail.relationshipImpact}</p>
            
            ${partnerTipsCardHtml}
        </div>

        <div class="action-plan">
            <div class="action-plan-title"><span>🌱</span><span>成长建议</span></div>
            ${detail.actions.map((action, i) => `
                <div class="action-item">
                    <div class="action-number">${i + 1}</div>
                    <div class="action-title">${action.title}</div>
                    <div class="action-desc">${action.desc}</div>
                    <div class="action-how"><strong>Try: </strong>${action.how}</div>
                </div>
            `).join('')}
        </div>

        <div class="premium-conversion-card">
            <div class="premium-conversion-title">升级为「关系行动包」</div>
            <div class="premium-conversion-subtitle">不是听道理，而是拿到就能照做</div>
            <div class="premium-value-list">
                <div class="premium-value-item">✅ 冲突场景处理清单（冷战/已读不回/情绪上头）</div>
                <div class="premium-value-item">✅ 可直接复制的沟通修复话术模板</div>
                <div class="premium-value-item">✅ 7天关系回温行动步骤（每天1步）</div>
            </div>
            <div class="premium-price-row">
                <span class="premium-price-current">¥29</span>
                <span class="premium-price-original">¥99</span>
                <span class="premium-price-tag">限时体验价</span>
            </div>
            <button class="premium-conversion-button" onclick="showPremiumOffer()">立即获取行动包（小红书发货）</button>
            <div class="premium-trust">已有 12,000+ 用户领取并使用 · 下单后尽快发货</div>
        </div>


        <div class="today-action">
            <div class="today-action-icon">✨</div>
            <div class="today-action-title">今天就开始</div>
            <div class="today-action-text">${detail.todayAction}</div>
            <button class="today-action-button" onclick="showToast('已加入你的行动清单 💪', '🎯')">我会尝试</button>
        </div>
        
 
    `;

    getEl('resultContent').innerHTML = html;
    showScreen('resultScreen');
}


function showPremiumOffer() {
    showModal(
        '领取你的关系行动包',
        '限时价 ¥29（原价 ¥99）。下单后小红书发货，包含：\n1) 冲突场景应对清单\n2) 可复制沟通话术模板\n3) 7天关系行动步骤\n\n加赠「伴侣沟通速查卡」。',
        () => {
            showToast('已为你准备好行动包入口，请前往小红书下单 📦', '✨');
        }
    );
}

function restartTest() {
    showModal('重新测试？', '你的当前结果将不会被保存。', () => {
        showToast('开始新的探索...', '🌱');
        setTimeout(() => showScreen('welcomeScreen'), 500);
    });
}

function shareResult() {
    // 这里可以后续扩展为生成图片或复制链接
    showToast('感谢分享你的成长之旅 💚', '✨');
}

// ---------------------------------------------------------
// 核心逻辑：计分算法与归一化
// ---------------------------------------------------------
function calculateFinalResults() {
    let totalAx = 0;
    let totalAv = 0;
    const count = questions.length;

    // 1. 累加所有题目的得分
    answers.forEach((optionIndex, questionIndex) => {
        const question = questions[questionIndex];
        if (question && question.options[optionIndex]) {
            const score = question.options[optionIndex].scores;
            totalAx += score.ax;
            totalAv += score.av;
        }
    });

    // 2. 计算平均分 (-1.0 到 1.0)
    let avgAx = totalAx / count;
    let avgAv = totalAv / count;

    // 3. 归一化 -> 映射到 0-100%
    let percentAx = ((avgAx + 1) / 2) * 100;
    let percentAv = ((avgAv + 1) / 2) * 100;

    // --- 新增逻辑：添加微量随机偏移 (Jitter) ---
    // 目的：避免红点死板地压在坐标轴线上，增加“有机感”
    // 只有当分数非常接近轴线 (45%-55%) 时，才施加更明显的偏移
    const addJitter = (val) => {
        // 基础噪音：±1.5% 的随机波动
        let jitter = (Math.random() - 0.5) * 3; 
        
        // 如果值在正中间 (接近50%)，强制增加一点额外偏移，避免压线
        if (Math.abs(val - 50) < 2) {
            // 随机决定是向左还是向右推一点
            const push = (Math.random() > 0.5 ? 1 : -1) * (1.5 + Math.random() * 1.5);
            jitter += push;
        }
        return val + jitter;
    };

    percentAx = addJitter(percentAx);
    percentAv = addJitter(percentAv);

    // 边界限制：防止偏移后溢出图表 (保留 5% 的边距)
    percentAx = Math.max(5, Math.min(95, percentAx));
    percentAv = Math.max(5, Math.min(95, percentAv));

    // 4. 判定依恋类型 (基于原始数学分数，不使用加了噪音的分数，保证结果准确)
    let type = '';
    const threshold = 0; 

    // 修正后的象限判定逻辑
    if (avgAx <= threshold && avgAv <= threshold) {
        type = 'secure';    // 低焦虑，低回避
    } else if (avgAx > threshold && avgAv <= threshold) {
        type = 'anxious';   // 高焦虑，低回避 (左上)
    } else if (avgAx <= threshold && avgAv > threshold) {
        type = 'avoidant';  // 低焦虑，高回避 (右下)
    } else {
        type = 'fearful';   // 高焦虑，高回避 (右上)
    }

    return {
        type: type,
        // 数学坐标 (用于显示数值，保留原始准确值)
        coordinates: { x: avgAv, y: avgAx }, 
        // 视觉坐标 (用于画图，包含随机偏移)
        visual: { x: percentAv, y: percentAx } 
    };
}
// ---------------------------------------------------------
// 初始化
// ---------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => showToast('欢迎来到PsycheFit 🌱', '👋'), 1000);
    
    // 注入必要的动态样式
    const styleSheet = document.createElement("style");
    styleSheet.innerText = `
        @keyframes popIn {
          0% { transform: translate(-50%, 50%) scale(0); opacity: 0; }
          60% { transform: translate(-50%, 50%) scale(1.2); opacity: 1; }
          100% { transform: translate(-50%, 50%) scale(1); }
        }
    `;
    document.head.appendChild(styleSheet);
});