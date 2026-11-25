/** Runs before first paint (inlined in <head>) so the saved theme never flashes the wrong colours. */
export const THEME_BOOT_SCRIPT = `try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;
