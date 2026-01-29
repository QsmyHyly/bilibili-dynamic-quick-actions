class BilibiliOpusContent {
  constructor() {
    this.init();
  }

  async init() {
    // 添加快捷按钮
    this.addQuickButton();
  }

  addQuickButton() {
    this.buttonAdded = false;
    const delays = [300, 600, 2000];

    const tryAddButton = (delay) => {
      if (this.buttonAdded) return;

      setTimeout(() => {
        if (this.buttonAdded) return;

        const sideToolbarBox = document.querySelector('.side-toolbar__box');
        if (sideToolbarBox) {
          // 创建快捷操作按钮
          const quickButton = document.createElement('div');
          quickButton.className = 'side-toolbar__action quick-action';
          // 使用本地SVG文件
          const svgUrl = chrome.runtime.getURL('icons/快捷操作.svg');
          quickButton.innerHTML = `
            <img src="${svgUrl}" width="24" height="24" alt="快捷操作">
            <div class="side-toolbar__action__text">快捷操作</div>
          `;
          
          quickButton.style.cursor = 'pointer';
          quickButton.style.whiteSpace = 'nowrap';
          quickButton.style.display = 'flex';
          quickButton.style.flexDirection = 'column';
          quickButton.style.alignItems = 'center';
          
          quickButton.addEventListener('click', async () => {
            // 使用动态注入执行快捷操作
            await this.executeWithDynamicInjection();
          });

          sideToolbarBox.appendChild(quickButton);
          this.buttonAdded = true;
        }
      }, delay);
    };

    delays.forEach(delay => tryAddButton(delay));
  }



  async executeWithDynamicInjection() {
    try {
      // 检查 executeQuickActions 函数是否已存在
      const checkResult = await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          action: 'checkScript',
          functionName: 'executeQuickActions'
        }, (response) => {
          resolve(response?.exists || false);
        });
      });

      // 如果函数不存在，才加载 executeQuickActions.js
      if (!checkResult && !this.isLoadingScript) {
        this.isLoadingScript = true;
        await new Promise((resolve) => {
          chrome.runtime.sendMessage({
            action: 'loadScript',
            scriptFile: 'executeQuickActions.js'
          }, () => {
            resolve();
          });
        });
        this.isLoadingScript = false;
        chrome.runtime.sendMessage({
          action: 'log',
          message: 'Content已加载executeQuickActions.js'
        });
      }

      // 等待 executeQuickActions 函数加载完成
      while (typeof executeQuickActions === 'undefined') {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // 从后台获取最新设置
      const settings = await new Promise((resolve) => {
        chrome.runtime.sendMessage({action: 'getSettings'}, (response) => {
          if (response && response.settings) {
            resolve(response.settings);
          } else {
            // 使用默认设置
            resolve({
              likeEnabled: true,
              favoriteEnabled: true,
              imageAction: 'download'
            });
          }
        });
      });

      // 记录获取到的设置
      chrome.runtime.sendMessage({
        action: 'log',
        message: `Content获取到的设置: likeEnabled=${settings.likeEnabled}, favoriteEnabled=${settings.favoriteEnabled}, imageEnabled=${settings.imageEnabled}, imageAction=${settings.imageAction}`
      });

      // 直接在当前页面执行操作（content.js已经运行在目标页面中）
      const actionResults = executeQuickActions(settings);
      
      chrome.runtime.sendMessage({
        action: 'log',
        message: `Content执行executeQuickActions完成，结果: ${JSON.stringify(actionResults)}`
      });
      
      // 处理图片操作（如果需要）
      if (settings.imageEnabled && settings.imageAction !== 'none' && actionResults?.imageUrls?.length > 0) {
        chrome.runtime.sendMessage({
          action: 'handleImages',
          imageUrls: actionResults.imageUrls,
          imageAction: settings.imageAction
        });
      }

      // 显示操作结果
      const successActions = [];
      if (actionResults?.like?.success) successActions.push('点赞');
      if (actionResults?.favorite?.success) successActions.push('收藏');
      if (actionResults?.imageUrls?.length > 0) successActions.push('图片处理');

      if (successActions.length > 0) {
        console.log(`快捷操作执行成功：${successActions.join('、')}`);
      } else {
        console.log('未执行任何操作或操作失败');
      }
      
    } catch (error) {
      console.error('执行快捷操作时出错:', error);
      chrome.runtime.sendMessage({
        action: 'log',
        message: `Content执行快捷操作出错: ${error.message}`
      });
    }
  }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  new BilibiliOpusContent();
});

// 如果页面已经加载完成，直接初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new BilibiliOpusContent();
  });
} else {
  new BilibiliOpusContent();
}