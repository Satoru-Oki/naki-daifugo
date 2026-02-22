let timerId = null;
self.onmessage = (e) => {
  if (e.data === "start") {
    if (timerId) clearInterval(timerId);
    timerId = setInterval(() => self.postMessage("heartbeat"), 15000);
  } else if (e.data === "stop") {
    if (timerId) { clearInterval(timerId); timerId = null; }
  }
};
