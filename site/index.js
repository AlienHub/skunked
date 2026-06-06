const API_BASE =
  new URLSearchParams(window.location.search).get("api") ||
  "https://skunked-open-data.zhouxiansheng1958.workers.dev"

function observeFadeIn() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible")
          observer.unobserve(entry.target)
        }
      })
    },
    { threshold: 0.14 }
  )

  document.querySelectorAll(".fade-in").forEach((node) => observer.observe(node))
}

function setMetric(id, value) {
  const el = document.getElementById(id)
  if (!el) return
  el.textContent = String(value)
}

async function loadManifest() {
  try {
    const res = await fetch(`${API_BASE.replace(/\/$/, "")}/v1/open/manifest`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()

    setMetric("metric-version", data.version || "uninitialized")
    setMetric("metric-apps", data?.counts?.apps ?? 0)
    setMetric("metric-official", data?.counts?.officialDomains ?? 0)
    setMetric("metric-phishing", data?.counts?.phishingConfirmed ?? 0)
  } catch (error) {
    setMetric("metric-version", "offline")
    setMetric("metric-apps", "-")
    setMetric("metric-official", "-")
    setMetric("metric-phishing", "-")
  }
}

observeFadeIn()
loadManifest()
