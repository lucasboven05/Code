// Counts in-app page views since the page was loaded, so "Back" can tell whether there is an in-app page to go back to.
// (document.referrer is not updated by client-side navigation, so it cannot be used for this.)
let views = 0;
export const noteNav = () => { views += 1; };
export const canGoBack = () => views > 1;
