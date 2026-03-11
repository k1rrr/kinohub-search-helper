(function() {
  let lastInjectedUrl = "";
  let lastCheckedUrl = location.href;
  let pollingTimer = null;

  function isMoviePage() {
    const url = location.href;
    return url.includes('/film/') || url.includes('/series/') || url.includes('/title/') ||
           url.includes('/m/') || url.includes('/tv/') ||
           url.includes('/movie/') ||
           url.includes('/anime/') || url.includes('/animes/');
  }

  function cleanTitle(raw) {
    return raw
      .split('\n')[0]
      .replace(/\s*\([^)]*сериал[^)]*\)/gi, '')
      .replace(/\s*\(мини[^)]*\)/gi, '')
      .replace(/\s*\(ТВ[^)]*\)/gi, '')
      .replace(/\s*\(\d{4}\)/, '')
      .trim();
  }

  function extractYear(text) {
    const match = text.match(/(\d{4})/);
    return match ? match[1] : "";
  }

  function makeSearchQuery(title, host) {
    let q = title;

    if (host.includes("shikimori.one") || host.includes("shikimori.me")) {
      q = q.replace(/\s*\(\d{4}\)/g, '');          
      q = q.replace(/:.*$/g, '');                   
      q = q.replace(/[.·]\s*Часть\s*\d*/gi, '');  
      q = q.replace(/\s+\d+\s*$/, '');              
      q = q.trim();

    } else if (host.includes("myanimelist.net")) {
      q = q.replace(/:.*$/, '');                    
      q = q.replace(/\s*-\s+.*$/, '');              
      q = q.replace(/\s+\d+(st|nd|rd|th)\s+Season.*/i, ''); 
      q = q.replace(/\s+Season\s+\d+.*/i, '');      
      q = q.replace(/\s+S\d+.*$/i, '');            
      q = q.replace(/\s+Part\s+\d+.*/i, '');       
      q = q.replace(/\s*\(\d{4}\)/g, '');           
      q = q.trim();

    } else if (host.includes("rottentomatoes.com")) {
      q = q.replace(/\s*\|.*$/g, '');                
      q = q.replace(/\s*\(\d{4}\)/g, '');          
      q = q.trim();

    } else if (host.includes("metacritic.com")) {
      q = q.replace(/^[❮❯◀▶←→<>\u276e\u276f]+\s*/g, ''); 
      q = q.replace(/\s*\(\d{4}\)/g, '');           
      q = q.replace(/\s+Season\s+\d+.*/i, '');      
      q = q.replace(/\s+\d+(st|nd|rd|th)\s+Season.*/i, ''); 
      q = q.replace(/:.*$/, '');                    
      q = q.trim();

    } else if (host.includes("imdb.com")) {
      q = q.replace(/:.*$/, '');
      q = q.trim();

    } else if (host.includes("kinopoisk.ru")) {
      q = q.replace(/\s*\(\d{4}\)/g, '');
      q = q.trim();
    }

    return q;
  }

  function shouldAddYear(host) {
    return host.includes("imdb.com");
  }

  function getMovieInfo() {
    const host = window.location.hostname;
    if (!isMoviePage()) return null;

    let title = "";
    let year = "";

    try {
      if (host.includes("imdb.com")) {
        const h1 = document.querySelector('h1[data-testid="hero__primary-text"]') || document.querySelector('h1');
        title = h1?.innerText || "";
        year = document.querySelector('[data-testid="hero__text-content"] ul li a')?.innerText.match(/\d{4}/)?.[0] || "";

      } else if (host.includes("kinopoisk.ru")) {
        const h1 = document.querySelector('h1[data-tid="f929306a"]') || 
                   document.querySelector('h1[class*="title"]') || 
                   document.querySelector('h1');
        if (h1 && !h1.innerText.toLowerCase().includes("кинопоиск")) {
          const rawText = h1.innerText;
          title = cleanTitle(rawText);
          year = extractYear(rawText);
          if (!year) {
            const yearLink = document.querySelector('a[href*="year"]');
            year = yearLink?.innerText.match(/\d{4}/)?.[0] || "";
          }
        }

      } else if (host.includes("rottentomatoes.com")) {
        const titleEl = document.querySelector('h1#media-hero-label') ||
                        document.querySelector('h1.title') ||
                        document.querySelector('h1');
        if (titleEl) {
          title = titleEl.innerText.replace(/\s+/g, ' ').trim();
          title = title.replace(/\s*\|.*$/g, '').trim();
        }
        const jsonEl = document.querySelector('script#media-hero-json');
        if (jsonEl) {
          try {
            const data = JSON.parse(jsonEl.textContent);
            if (data.releaseYear) year = data.releaseYear;
          } catch(e) {}
        }
        if (!year) {
          const metaProps = document.querySelectorAll('rt-text[slot="metadata-prop"]');
          metaProps.forEach(el => {
            const m = el.textContent.match(/\d{4}/);
            if (m && !year) year = m[0];
          });
        }

      } else if (host.includes("metacritic.com")) {
        const h1 = document.querySelector('[data-testid="hero-title"]') ||
                   document.querySelector('.c-productHero_title') ||
                   document.querySelector('.c-productSubpageHeader_title');
        if (h1) {
          title = h1.innerText.trim();
          title = title.replace(/^[❮❯◀▶←→<>\u276e\u276f]+\s*/g, '').trim();
        }
        if (!title || title.length < 2) {
          const pageTitle = document.title;
          if (pageTitle && pageTitle.includes('Metacritic')) {
            title = pageTitle.replace(/\s*[-|].*Metacritic.*$/i, '').replace(/\s*Reviews?\s*$/i, '').trim();
          }
        }
        const relDate = document.querySelector('[data-testid="hero-subnav"] span') ||
                        document.querySelector('.c-heroModule_releaseDate');
        if (relDate) {
          year = extractYear(relDate.innerText);
        }

      } else if (host.includes("myanimelist.net")) {
        const h1 = document.querySelector('h1.title-name strong') ||
                   document.querySelector('h1.title-name') ||
                   document.querySelector('h1');
        if (h1) {
          title = h1.innerText.trim();
        }
        const infoSpans = document.querySelectorAll('.spaceit_pad');
        infoSpans.forEach(sp => {
          if (!year && sp.textContent.includes('Aired:')) {
            year = extractYear(sp.textContent.replace('Aired:', ''));
          }
        });
        if (!year) {
          const seasonLink = document.querySelector('span.information.season a');
          if (seasonLink) year = extractYear(seasonLink.textContent);
        }

      } else if (host.includes("shikimori.one") || host.includes("shikimori.me")) {
        const h1 = document.querySelector('header.head h1');
        if (h1) {
          const fullText = h1.innerText.trim();
          const parts = fullText.split(/\s*\/\s*/);
          title = parts[0].trim();
        }
        const dateMeta = document.querySelector('meta[itemprop="dateCreated"]');
        if (dateMeta) {
          year = extractYear(dateMeta.content);
        }
        if (!year) {
          const infoLines = document.querySelectorAll('.b-entry-info .line-container .line');
          infoLines.forEach(line => {
            if (!year && line.textContent.match(/\d{4}/)) {
              year = extractYear(line.textContent);
            }
          });
        }
      }

      // Fallback to og:title
      if (!title || title.length < 2) {
        const ogTitle = document.querySelector('meta[property="og:title"]')?.content;
        if (ogTitle && !ogTitle.toLowerCase().includes("кинопоиск")) {
          let cleaned = ogTitle.split(' — ')[0].split(' - ')[0].trim();
          cleaned = cleaned.replace(/\s*\|.*$/g, '').trim();
          cleaned = cleanTitle(cleaned);
          title = cleaned;
          if (!year) {
            year = extractYear(ogTitle);
          }
        }
      }
    } catch (e) {
      console.error("KinoHub Info Error:", e);
    }

    return (title && title.length > 1) ? { title, year } : null;
  }

  function getSiteClass() {
    const host = window.location.hostname;
    if (host.includes("imdb.com")) return "kinohub-site-imdb";
    if (host.includes("kinopoisk.ru")) return "kinohub-site-kinopoisk";
    if (host.includes("rottentomatoes.com")) return "kinohub-site-rt";
    if (host.includes("metacritic.com")) return "kinohub-site-metacritic";
    if (host.includes("myanimelist.net")) return "kinohub-site-mal";
    if (host.includes("shikimori.one") || host.includes("shikimori.me")) return "kinohub-site-shikimori";
    return "";
  }

  function inject() {
    if (!isMoviePage()) return false;

    const currentUrl = window.location.href;

    if (document.getElementById('kinohub-search-btn') && lastInjectedUrl === currentUrl) {
      return true;
    }

    const info = getMovieInfo();
    if (!info) return false;

    const host = window.location.hostname;

    let query = makeSearchQuery(info.title, host);
    if (shouldAddYear(host) && info.year) {
      query = `${query} (${info.year})`;
    }

    const oldBtn = document.getElementById('kinohub-search-btn');
    if (oldBtn) oldBtn.remove();

    const btn = document.createElement('a');
    btn.id = 'kinohub-search-btn';
    btn.className = 'kinohub-search-button ' + getSiteClass();
    btn.innerText = 'Смотреть на KinoHub';
    btn.href = `https://tv.kinohub.vip/search?query=${encodeURIComponent(query)}`;
    btn.target = '_blank';

    let target = null;
    let injected = false;

    if (host.includes("kinopoisk.ru")) {
      target = document.querySelector('[data-tid="6979203b"]') || 
               document.querySelector('[class*="buttons"]') ||
               document.querySelector('h1');
      if (target) {
        if (target.tagName === 'H1') target.after(btn);
        else target.prepend(btn);
        injected = true;
      }

    } else if (host.includes("imdb.com")) {
      target = document.querySelector('[data-testid="hero__primary-text"]') ||
               document.querySelector('h1');
      if (target) {
        target.after(btn);
        injected = true;
      }

    } else if (host.includes("rottentomatoes.com")) {
      target = document.querySelector('h1#media-hero-label') ||
               document.querySelector('h1.title') ||
               document.querySelector('h1');
      if (target) {
        target.after(btn);
        injected = true;
      }

    } else if (host.includes("metacritic.com")) {
      target = document.querySelector('[data-testid="hero-title"]') ||
               document.querySelector('.c-productHero_title') ||
               document.querySelector('.c-productSubpageHeader_title') ||
               document.querySelector('h1');
      if (target) {
        target.after(btn);
        injected = true;
      }

    } else if (host.includes("myanimelist.net")) {
      target = document.querySelector('.h1-title') ||
               document.querySelector('h1.title-name') ||
               document.querySelector('h1');
      if (target) {
        target.after(btn);
        injected = true;
      }

    } else if (host.includes("shikimori.one") || host.includes("shikimori.me")) {
      target = document.querySelector('header.head h1');
      if (target) {
        target.after(btn);
        injected = true;
      }

    } else {
      target = document.querySelector('h1');
      if (target) {
        target.after(btn);
        injected = true;
      }
    }

    if (injected) {
      lastInjectedUrl = currentUrl;
      return true;
    }

    return false;
  }

  function startPolling() {
    stopPolling();
    let attempts = 0;
    const maxAttempts = 120;

    function poll() {
      if (inject()) {
        pollingTimer = null;
        return;
      }
      attempts++;
      if (attempts < maxAttempts) {
        pollingTimer = setTimeout(poll, 500);
      }
    }

    poll();
  }

  function stopPolling() {
    if (pollingTimer) {
      clearTimeout(pollingTimer);
      pollingTimer = null;
    }
  }

  setInterval(() => {
    const currentUrl = location.href;
    if (currentUrl !== lastCheckedUrl) {
      lastCheckedUrl = currentUrl;
      lastInjectedUrl = "";
      const oldBtn = document.getElementById('kinohub-search-btn');
      if (oldBtn) oldBtn.remove();
      if (isMoviePage()) {
        startPolling();
      }
    }
  }, 800);

  function setupObserver() {
    const root = document.documentElement || document.body;
    if (!root) {
      setTimeout(setupObserver, 10);
      return;
    }

    const observer = new MutationObserver(() => {
      if (isMoviePage() && (!document.getElementById('kinohub-search-btn') || lastInjectedUrl !== location.href)) {
        inject();
      }
    });

    observer.observe(root, {
      childList: true,
      subtree: true
    });
  }

  setupObserver();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      if (isMoviePage()) startPolling();
    }, { once: true });
    window.addEventListener('load', () => {
      if (isMoviePage()) startPolling();
    }, { once: true });
  } else if (document.readyState === 'interactive') {
    if (isMoviePage()) startPolling();
    window.addEventListener('load', () => {
      if (isMoviePage()) startPolling();
    }, { once: true });
  } else {
    if (isMoviePage()) startPolling();
  }

  window.addEventListener('popstate', () => {
    lastInjectedUrl = "";
    if (isMoviePage()) startPolling();
  });

  document.addEventListener('turbolinks:load', () => {
    lastInjectedUrl = "";
    if (isMoviePage()) startPolling();
  });

  window.addEventListener('pageshow', (e) => {
    if (e.persisted) {
      lastInjectedUrl = "";
      if (isMoviePage()) startPolling();
    }
  });
})();
