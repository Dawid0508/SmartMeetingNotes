//chrome

/* This block of code is a listener in a Chrome extension background script. It listens for updates to
tabs in the browser. When a tab is updated and its status becomes "complete" and the URL of the tab
starts with "http", it executes a content script named "content.js" in that tab using the
`chrome.scripting.executeScript` method. If the script injection is successful, it logs a message to
the console saying "we have injected the content script". If there is an error during the script
injection process, it logs the error message to the console. */

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab)=>{
    if(changeInfo.status === "complete" && /^http/.test(tab.url)){
        chrome.scripting.executeScript({
            target: {tabId},
            files: ["content.js"]
        }).then(()=>{
            console.log("we have injected the content script")
        }).catch(err=> console.log(err, "error in background script line 10"))
    }
})


