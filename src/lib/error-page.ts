export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Connecting to EventEase…</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body {
        font-family: 'Inter', system-ui, -apple-system, sans-serif;
        background: #0B1728;
        color: #F7FAFF;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        margin: 0;
        padding: 1.5rem;
        text-align: center;
      }
      .spinner {
        width: 38px;
        height: 38px;
        border: 3px solid rgba(79, 140, 255, 0.2);
        border-top-color: #4F8CFF;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
        margin-bottom: 1.25rem;
      }
      @keyframes spin { to { transform: rotate(360deg); } }
      h1 { font-size: 1.25rem; font-weight: 700; margin: 0 0 0.5rem; letter-spacing: -0.01em; }
      p { color: #94A3B8; font-size: 0.875rem; margin: 0 0 1.5rem; max-width: 22rem; line-height: 1.5; }
      .actions { display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap; }
      a, button {
        padding: 0.6rem 1.25rem;
        border-radius: 0.625rem;
        font: inherit;
        font-size: 0.875rem;
        font-weight: 600;
        cursor: pointer;
        text-decoration: none;
        transition: all 0.2s ease;
      }
      .primary {
        background: #4F8CFF;
        color: #061120;
        border: none;
      }
      .primary:hover { background: #6EA8FF; }
      .secondary {
        background: rgba(255, 255, 255, 0.08);
        color: #F7FAFF;
        border: 1px solid rgba(255, 255, 255, 0.12);
      }
      .secondary:hover { background: rgba(255, 255, 255, 0.14); }
    </style>
    <script>
      // Auto-reconnect after 1.5s so transient SSR glitches heal immediately
      setTimeout(function() {
        window.location.reload();
      }, 1500);
    </script>
  </head>
  <body>
    <div class="spinner"></div>
    <h1>Connecting to EventEase…</h1>
    <p>Please wait a moment while the page loads.</p>
    <div class="actions">
      <button class="primary" onclick="location.reload()">Reload now</button>
      <a class="secondary" href="/">Go home</a>
    </div>
  </body>
</html>`;
}
