function executeQuickActions(settings) {
  chrome.runtime.sendMessage({
    action: 'log',
    message: `executeQuickActions开始执行，设置: ${JSON.stringify(settings)}`
  });

  const likeOpus = () => {
    // 旧版选择器
    let likeButton = document.querySelector('.side-toolbar__action.like');
    let isActiveClass = 'is-active';
    
    // 新版选择器：查找包含 icon-like_p 的 toolbar-item
    if (!likeButton) {
      const toolbarItems = document.querySelectorAll('.toolbar-item');
      for (const item of toolbarItems) {
        const icon = item.querySelector('.icon-like_p');
        if (icon) {
          likeButton = item;
          isActiveClass = 'toolbar-on';
          break;
        }
      }
    }
    
    if (likeButton && !likeButton.classList.contains(isActiveClass)) {
      likeButton.click();
      return { success: true, action: 'like' };
    }
    if (!likeButton) {
      return { success: false, action: 'like', reason: '未找到按钮' };
    }
    if (likeButton.classList.contains(isActiveClass)) {
      return { success: false, action: 'like', reason: '已点赞' };
    }
  };

  const favoriteOpus = () => {
    // 旧版选择器
    let favoriteButton = document.querySelector('.side-toolbar__action.favorite');
    let isActiveClass = 'is-active';
    
    // 新版选择器：查找包含 icon-collect_p 的 toolbar-item
    if (!favoriteButton) {
      const toolbarItems = document.querySelectorAll('.toolbar-item');
      for (const item of toolbarItems) {
        const icon = item.querySelector('.icon-collect_p');
        if (icon) {
          favoriteButton = item;
          isActiveClass = 'toolbar-on';
          break;
        }
      }
    }
    
    if (favoriteButton && !favoriteButton.classList.contains(isActiveClass)) {
      favoriteButton.click();
      return { success: true, action: 'favorite' };
    }
    if (!favoriteButton) {
      return { success: false, action: 'favorite', reason: '未找到按钮' };
    }
    if (favoriteButton.classList.contains(isActiveClass)) {
      return { success: false, action: 'favorite', reason: '已收藏' };
    }
  };

  const extractImageUrls = () => {
    const imageUrls = new Set();
      
      const dynPicContainers = document.querySelectorAll('.opus-module-top, .opus-module-content, .opus-paragraph-children, .article-content');
      
      dynPicContainers.forEach(dynPicContainer => {
        const allImages = dynPicContainer.querySelectorAll('img');
        
        allImages.forEach(img => {
          const src = img.getAttribute('data-src') || img.src;
          
          if (src && (src.includes('.jpg') || src.includes('.jpeg') || 
                      src.includes('.png') || src.includes('.webp') || 
                      src.includes('.gif'))) {
            
            let cleanedUrl = src;
            
            if (cleanedUrl.startsWith('//')) {
              cleanedUrl = 'https:' + cleanedUrl;
            }
            
            cleanedUrl = cleanedUrl.replace(/^http:/, 'https:');
            cleanedUrl = cleanedUrl.replace(/@[^\s]*/, '');
            cleanedUrl = cleanedUrl.replace(/\?.*$/, '');
            
            if (cleanedUrl.includes('/bfs/') || cleanedUrl.includes('new_dyn')) {
              imageUrls.add(cleanedUrl);
            }
          }
        });
      });
    
    return Array.from(imageUrls);
  };

  const results = {
    like: settings.likeEnabled ? likeOpus() : { skipped: true, action: 'like' },
    favorite: settings.favoriteEnabled ? favoriteOpus() : { skipped: true, action: 'favorite' },
    imageUrls: (settings.imageEnabled && settings.imageAction !== 'none') ? extractImageUrls() : []
  };

  return results;
}
