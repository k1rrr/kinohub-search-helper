chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "searchKinohub",
    title: "Смотреть на KinoHub",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "searchKinohub" && info.selectionText) {
    const query = encodeURIComponent(info.selectionText.trim());
    const url = `https://tv.kinohub.vip/search?query=${query}`;
    chrome.tabs.create({ url: url });
  }
});
