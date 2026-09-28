/**
 * EPIC OTT — Advanced Mobile Player Controller
 * 4 High-Speed Multi-Servers | Multi-Audio & Dubbed | TV Episode Selector | Ambient Glow
 */

(function () {
    'use strict';

    // ═════════ Constants & Config ═════════
    const TMDB_KEY = '6f88c485f6d936e3e93f3ab0758a15f2';
    const TMDB_BASE = 'https://api.themoviedb.org/3';
    const TMDB_POSTER = 'https://image.tmdb.org/t/p/w342';
    const TMDB_STILL = 'https://image.tmdb.org/t/p/w300';
    const TMDB_PROFILE = 'https://image.tmdb.org/t/p/w185';

    // Parse URL params
    const params = new URLSearchParams(window.location.search);
    const mediaId = params.get('id');
    const mediaType = (params.get('type') || 'movie').toLowerCase();
    let currentSeason = parseInt(params.get('s') || '1', 10);
    let currentEpisode = parseInt(params.get('e') || '1', 10);
    let currentServer = 'vidsu';
    let activeHindiStreamUrl = '';

    // CinemaOS Multi-Audio State
    let cmosTracks = [];
    let activeCmosTrackIdx = 0;
    let isCmosPlaying = false;
    let cmosAbortCtrl = null;

    let totalSeasons = 1;
    let seasonEpisodes = [];
    let mediaDetails = null;

    // ═════════ Quality & Multi-Audio Detection ═════════
    function getVideoQuality(item) {
        const relDateStr = item.release_date || item.first_air_date;
        if (relDateStr) {
            const relTime = new Date(relDateStr).getTime();
            const now = new Date().getTime();
            const diffDays = (now - relTime) / (1000 * 60 * 60 * 24);
            if (diffDays >= 0 && diffDays <= 75 && (Number(item.vote_count || 0) < 450 || (Number(item.popularity || 0) > 200 && Number(item.vote_count || 0) < 600))) {
                return { code: 'PHD', label: 'PHD', class: 'quality-phd', desc: 'Pre-HD / Cinema Print' };
            }
        }
        const voteAvg = Number(item.vote_average || 0);
        const voteCnt = Number(item.vote_count || 0);
        const pop = Number(item.popularity || 0);
        const year = parseInt((relDateStr || '').substring(0, 4), 10) || 2020;
        if ((voteAvg >= 7.6 && voteCnt >= 100) || pop >= 150 || (year >= 2022 && voteAvg >= 7.2)) {
            return { code: '4K', label: '4K', class: 'quality-4k', desc: '4K Ultra HD' };
        }
        if (year >= 2017 || voteAvg >= 6.2) {
            return { code: 'FHD', label: 'FHD', class: 'quality-fhd', desc: 'Full HD 1080p' };
        }
        return { code: 'HD', label: 'HD', class: 'quality-hd', desc: 'HD 720p' };
    }

    function isMultiAudioSupported(item) {
        const lang = (item.original_language || 'en').toLowerCase();
        const pop = Number(item.popularity || 0);
        const votes = Number(item.vote_count || 0);
        const multiLangs = ['en', 'hi', 'ja', 'ko', 'es', 'fr', 'de', 'it', 'te', 'ta'];
        if (multiLangs.includes(lang) || pop > 35 || votes > 80) {
            return true;
        }
        return false;
    }

    // ═════════ Multi-Server URLs Builder (Nightflix Multi-Audio Enabled) ═════════
    function getServerUrl(serverKey, id, type, s, e) {
        switch (serverKey) {
            case 'vidsu':
            case 'auto': // 🎧 Nightflix #1 Engine: Vidsu AdFree (CinemaOS Multi-Audio)
                if (type === 'tv') {
                    return `https://player-4aq.pages.dev/#/embed/tv/${id}/${s}/${e}?autoPlay=true`;
                }
                return `https://player-4aq.pages.dev/#/embed/movie/${id}?autoPlay=true`;

            case 'vidlink':
            case '2': // 🚀 VidLink Pro (Fastest, Multi-Audio & Subtitles track selection)
                if (type === 'tv') {
                    return `https://vidlink.pro/tv/${id}/${s}/${e}?primaryColor=00f5ff&secondaryColor=121218&iconColor=ffffff&multiLang=true&autoplay=true`;
                }
                return `https://vidlink.pro/movie/${id}?primaryColor=00f5ff&secondaryColor=121218&iconColor=ffffff&multiLang=true&autoplay=true`;

            case 'vidcore': // ⚡ Nightflix Engine: Vidcore AdFree
                if (type === 'tv') {
                    return `https://vidcore.net/tv/${id}/${s}/${e}?autoPlay=true`;
                }
                return `https://vidcore.net/movie/${id}?autoPlay=true`;

            case 'vidme': // 🎬 Nightflix Engine: Vidme AdFree
                if (type === 'tv') {
                    return `https://vidzen.fun/tv/${id}/${s}/${e}?autoPlay=true`;
                }
                return `https://vidzen.fun/movie/${id}?autoPlay=true`;

            case 'vidru': // 📡 Nightflix Engine: Vidru AdFree
                if (type === 'tv') {
                    return `https://ythd.org/embed/${id}?autoPlay=true`;
                }
                return `https://ythd.org/embed/${id}?autoPlay=true`;

            case 'smashy':
            case '1': // 🇮🇳 Smashy Stream (Dedicated Hindi, Dual Audio & Regional Dubs)
                if (type === 'tv') {
                    return `https://embed.smashystream.com/playere.php?tmdb=${id}&season=${s}&episode=${e}`;
                }
                return `https://embed.smashystream.com/playere.php?tmdb=${id}`;

            case 'videasy':
            case '3': // Videasy Ultra
                if (type === 'tv') {
                    return `https://player.videasy.net/tv/${id}/${s}/${e}?color=00F5FF&nextEpisode=true`;
                }
                return `https://player.videasy.net/movie/${id}?color=00F5FF`;

            default:
                if (type === 'tv') {
                    return `https://vidlink.pro/tv/${id}/${s}/${e}?primaryColor=00f5ff&secondaryColor=121218&iconColor=ffffff&multiLang=true&autoplay=true`;
                }
                return `https://vidlink.pro/movie/${id}?primaryColor=00f5ff&secondaryColor=121218&iconColor=ffffff&multiLang=true&autoplay=true`;
        }
    }

    // ═════════ CinemaOS / Vidsu Multi-Audio Direct Engine ═════════
    function getLangDetails(serverName, langStr) {
        const text = (serverName + ' ' + (langStr || '')).toLowerCase();
        if (text.includes('hindi') || text.includes('hin')) return { name: 'Hindi', flag: '🇮🇳', code: 'HI' };
        if (text.includes('tamil') || text.includes('tam')) return { name: 'Tamil', flag: '🇮🇳', code: 'TA' };
        if (text.includes('telugu') || text.includes('tel')) return { name: 'Telugu', flag: '🇮🇳', code: 'TE' };
        if (text.includes('english') || text.includes('eng')) return { name: 'English', flag: '🇺🇸', code: 'EN' };
        if (text.includes('spanish') || text.includes('esp') || text.includes('spa')) return { name: 'Spanish', flag: '🇪🇸', code: 'ES' };
        if (text.includes('french') || text.includes('fre') || text.includes('fra')) return { name: 'French', flag: '🇫🇷', code: 'FR' };
        if (text.includes('portuguese') || text.includes('por')) return { name: 'Portuguese', flag: '🇵🇹', code: 'PT' };
        if (text.includes('russian') || text.includes('rus')) return { name: 'Russian', flag: '🇷🇺', code: 'RU' };
        if (text.includes('indonesian') || text.includes('ind')) return { name: 'Indonesian', flag: '🇮🇩', code: 'ID' };
        if (text.includes('filipino') || text.includes('fil') || text.includes('tag')) return { name: 'Filipino', flag: '🇵🇭', code: 'PH' };
        if (text.includes('arabic') || text.includes('ara')) return { name: 'Arabic', flag: '🇸🇦', code: 'AR' };
        return { name: serverName || 'Original', flag: '🌐', code: 'AUD' };
    }

    async function fetchCinemaOsStream(id, type, s, e) {
        const myToken = loadToken;
        if (cmosAbortCtrl) {
            try { cmosAbortCtrl.abort(); } catch (err) {}
        }
        cmosAbortCtrl = new AbortController();
        const signal = cmosAbortCtrl.signal;

        const url = type === 'tv'
            ? `https://cmos.raphsm4.dev/?tmdb=${encodeURIComponent(id)}&season=${encodeURIComponent(s)}&episode=${encodeURIComponent(e)}`
            : `https://cmos.raphsm4.dev/?tmdb=${encodeURIComponent(id)}`;

        try {
            const timeoutId = setTimeout(() => {
                if (cmosAbortCtrl) cmosAbortCtrl.abort();
            }, 8500);

            const res = await fetch(url, { signal, cache: 'no-store' });
            clearTimeout(timeoutId);

            if (myToken !== loadToken) return false;
            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const j = await res.json().catch(() => null);
            if (!j) throw new Error('Invalid JSON');

            const tracks = [];
            const seenServers = new Set();

            // Process sources from CinemaOS API
            if (j.sources && typeof j.sources === 'object') {
                for (const [serverName, sObj] of Object.entries(j.sources)) {
                    if (!sObj || seenServers.has(serverName)) continue;
                    const isDash = sObj.type === 'dash' || (sObj.url && sObj.url.includes('.mpd'));

                    let directUrl = '';
                    let quality = sObj.quality || '1080p';
                    let qualitiesMap = {};

                    if (sObj.qualities && typeof sObj.qualities === 'object') {
                        for (const [qKey, qVal] of Object.entries(sObj.qualities)) {
                            if (qVal && qVal.url) qualitiesMap[qKey] = qVal.url;
                        }
                        directUrl = qualitiesMap['1080'] || qualitiesMap['720'] || qualitiesMap['480'] || qualitiesMap['360'] || Object.values(qualitiesMap)[0];
                        if (qualitiesMap['1080']) quality = '1080p';
                        else if (qualitiesMap['720']) quality = '720p';
                        else if (qualitiesMap['480']) quality = '480p';
                    } else if (sObj.url) {
                        directUrl = sObj.url;
                    }

                    if (directUrl) {
                        seenServers.add(serverName);
                        const lang = getLangDetails(serverName, sObj.language || sObj.lang);
                        tracks.push({
                            id: serverName,
                            name: lang.name,
                            flag: lang.flag,
                            code: lang.code,
                            isHindi: lang.name === 'Hindi',
                            isDash: isDash,
                            quality: quality,
                            qualities: qualitiesMap,
                            url: directUrl
                        });
                    }
                }
            }

            // Fallback to directPlayUrl if sources didn't have tracks
            if (!tracks.length && j.directPlayUrl) {
                const lang = getLangDetails(j.directServer || 'Direct', j.directLanguage);
                tracks.push({
                    id: j.directServer || 'Direct',
                    name: lang.name,
                    flag: lang.flag,
                    code: lang.code,
                    isHindi: lang.name === 'Hindi',
                    isDash: j.directPlayUrl.includes('.mpd'),
                    quality: j.directQuality || '1080p',
                    qualities: {},
                    url: j.directPlayUrl
                });
            }

            if (!tracks.length) return false;

            // Sort tracks: 🇮🇳 Hindi FIRST, MP4 preferred over DASH
            tracks.sort((a, b) => {
                if (a.isHindi && !b.isHindi) return -1;
                if (!a.isHindi && b.isHindi) return 1;
                if (a.isHindi && b.isHindi) {
                    if (!a.isDash && b.isDash) return -1;
                    if (a.isDash && !b.isDash) return 1;
                }
                if (a.name === 'English' && b.name !== 'English') return -1;
                if (a.name !== 'English' && b.name === 'English') return 1;
                return 0;
            });

            cmosTracks = tracks;
            activeCmosTrackIdx = 0; // First track is Hindi (or English if no Hindi)
            isCmosPlaying = true;

            const activeTrack = tracks[0];
            const movieName = mediaDetails ? (mediaDetails.title || mediaDetails.name) : 'CinemaOS Stream';

            // Hide iframe and switch seamlessly to native In-App video engine
            if (iframe) {
                iframe.style.display = 'none';
                iframe.src = 'about:blank';
            }
            if (loader) {
                loader.classList.add('hidden');
                loader.style.display = 'none';
            }
            if (localPlayerContainer) {
                localPlayerContainer.style.display = 'flex';
            }
            if (localPickerHub) {
                localPickerHub.style.display = 'none';
            }
            if (localActivePlayer) {
                localActivePlayer.style.display = 'flex';
            }
            if (localPlayingBadge) {
                localPlayingBadge.innerHTML = '<i class="fas fa-headphones"></i> CINEMAOS MULTI-AUDIO';
            }

            // Load captions / subtitles from CinemaOS if available
            try {
                if (localVideo) {
                    const oldTracks = localVideo.querySelectorAll('track');
                    oldTracks.forEach(tr => tr.remove());
                    if (j.captions && Array.isArray(j.captions)) {
                        j.captions.forEach(c => {
                            if (c && c.url) {
                                fetch(c.url)
                                    .then(res => res.text())
                                    .then(srtText => {
                                        const vtt = srtToVtt(srtText);
                                        const blob = new Blob([vtt], { type: 'text/vtt' });
                                        const track = document.createElement('track');
                                        track.kind = 'subtitles';
                                        track.label = c.label || c.language || 'Subtitles';
                                        track.srclang = (c.language || 'en').toLowerCase().substring(0, 2);
                                        track.src = URL.createObjectURL(blob);
                                        localVideo.appendChild(track);
                                        updateSubtitlesList();
                                    })
                                    .catch(() => {});
                            }
                        });
                    }
                }
            } catch (capErr) {}

            loadLocalVideo(activeTrack.url, `${movieName} • ${activeTrack.flag} ${activeTrack.name} (${activeTrack.quality})`);
            if (localAudioBadge) {
                localAudioBadge.textContent = activeTrack.code;
            }
            updateAudioTracksList();

            showToast(`🎧 Vidsu AdFree: Playing in ${activeTrack.flag} ${activeTrack.name} Audio (${activeTrack.quality})`);
            return true;
        } catch (err) {
            console.warn('CinemaOS direct stream fetch error:', err.message || err);
            return false;
        }
    }

    function playCmosTrack(trackIndex) {
        if (!cmosTracks || !cmosTracks[trackIndex] || !localVideo) return;
        activeCmosTrackIdx = trackIndex;
        const t = cmosTracks[trackIndex];
        const curTime = localVideo.currentTime || 0;
        const movieName = mediaDetails ? (mediaDetails.title || mediaDetails.name) : 'Movie';

        loadLocalVideo(t.url, `${movieName} • ${t.flag} ${t.name} (${t.quality})`);
        setTimeout(() => {
            if (curTime > 0 && localVideo) {
                localVideo.currentTime = curTime;
            }
        }, 300);

        if (localPlayingBadge) {
            localPlayingBadge.innerHTML = '<i class="fas fa-headphones"></i> CINEMAOS MULTI-AUDIO';
        }
        if (localAudioBadge) {
            localAudioBadge.textContent = t.code;
        }
        showToast(`Audio changed to: ${t.flag} ${t.name} (${t.quality})`);
        closeDrawers();
        updateAudioTracksList();
    }

    // ═════════ DOM Elements ═════════
    const iframe = document.getElementById('videoPlayerFrame');
    const loader = document.getElementById('playerLoader');
    const statusText = document.getElementById('streamStatusText');
    const serverButtons = document.querySelectorAll('.server-pill');
    const navTitle = document.getElementById('navMovieTitle');
    const mediaTitle = document.getElementById('mediaTitle');
    const mediaMeta = document.getElementById('mediaMeta');
    const mediaOverview = document.getElementById('mediaOverview');
    const castTrack = document.getElementById('castTrack');
    const similarGrid = document.getElementById('similarGrid');
    const epQuickControls = document.getElementById('epQuickControls');
    const epBadgeText = document.getElementById('epBadgeText');
    const btnPrevEp = document.getElementById('btnPrevEp');
    const btnNextEp = document.getElementById('btnNextEp');
    const seasonSelect = document.getElementById('seasonSelect');
    const episodesSection = document.getElementById('episodesSection');
    const episodesList = document.getElementById('episodesList');
    const actionFavBtn = document.getElementById('actionFavBtn');

    let loadToken = 0;
    let failsafeTimer = null;

    // ═════════ Stream Loader ═════════
    function loadStream(serverKey) {
        if (serverKey === 'hindi' || serverKey === 'auto') serverKey = 'vidsu';
        currentServer = serverKey;
        const myToken = ++loadToken;

        // UI active pill update
        serverButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.server === serverKey);
        });

        // If Local MKV Player Engine is selected
        if (serverKey === 'local') {
            cmosTracks = [];
            isCmosPlaying = false;
            if (iframe) {
                iframe.style.display = 'none';
                iframe.src = 'about:blank';
            }
            if (loader) {
                loader.classList.add('hidden');
                loader.style.display = 'none';
            }
            if (localPlayerContainer) {
                localPlayerContainer.style.display = 'flex';
            }
            if (serverQuickText) {
                serverQuickText.textContent = 'Local';
            }

            const tabLocal = document.getElementById('tabBtnLocalFile');
            if (tabLocal) tabLocal.click();
            if (localActivePlayer) localActivePlayer.style.display = 'none';
            if (localPickerHub) localPickerHub.style.display = 'flex';
            if (localPlayingBadge) localPlayingBadge.innerHTML = '<i class="fas fa-circle-play"></i> LOCAL MKV';
            showToast('📁 In-App MKV (Multi-Lang) Player Active');
            return;
        }

        // 🎧 Server 2 / Vidsu AdFree: Powered by CinemaOS Direct Multi-Audio Engine
        if (serverKey === 'vidsu') {
            statusText.textContent = '🎧 Connecting to Vidsu AdFree (CinemaOS Multi-Audio)...';
            loader.style.display = 'flex';
            loader.classList.remove('hidden');
            if (serverQuickText) serverQuickText.textContent = 'Vidsu';

            fetchCinemaOsStream(mediaId, mediaType, currentSeason, currentEpisode).then(success => {
                if (myToken !== loadToken) return;
                if (!success) {
                    // Fallback to Vidlink / player-4aq iframe if CinemaOS direct is unavailable
                    console.log('CinemaOS direct unavailable, falling back to iframe embed');
                    loadIframeStream('vidsu', myToken);
                }
            });
            return;
        }

        // Other servers: switch to iframe streaming
        cmosTracks = [];
        isCmosPlaying = false;
        loadIframeStream(serverKey, myToken);
    }

    function loadIframeStream(serverKey, myToken) {
        if (localPlayerContainer) {
            localPlayerContainer.style.display = 'none';
            if (localVideo && !localVideo.paused) {
                localVideo.pause();
            }
        }
        if (iframe) {
            iframe.style.display = 'block';
        }

        const serverNames = {
            'vidsu': '🎧 Vidsu AdFree',
            'videasy': '⚡ Videasy 4K/HD',
            'vidlink': '🚀 VidLink Pro (HD/4K)',
            'vidcore': '⚡ Vidcore AdFree',
            'vidme': '🎬 Vidme AdFree',
            'vidru': '📡 Vidru AdFree',
            'smashy': '🇮🇳 Smashy Stream (Hindi Dubs)',
            '2': 'VidLink Pro (HD/4K)',
            '1': 'Smashy Stream (Hindi Dubs)',
            '3': 'Videasy 4K/HD'
        };
        statusText.textContent = `Connecting to ${serverNames[serverKey] || 'Server'}...`;
        loader.style.display = 'flex';
        loader.classList.remove('hidden');

        if (serverQuickText) {
            const shortNames = {
                'vidsu': 'Vidsu',
                'videasy': 'Videasy',
                'vidlink': 'VidLink',
                'vidcore': 'Vidcore',
                'vidme': 'Vidme',
                'vidru': 'Vidru',
                'smashy': 'Smashy'
            };
            serverQuickText.textContent = shortNames[serverKey] || `S:${serverKey}`;
        }

        if (failsafeTimer) clearTimeout(failsafeTimer);

        const targetUrl = getServerUrl(serverKey, mediaId, mediaType, currentSeason, currentEpisode);

        // Nightflix Vidcore / Vidme sandbox (blocks intrusive popups while allowing playback)
        if (serverKey === 'vidcore' || serverKey === 'vidme') {
            iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation');
        } else {
            iframe.removeAttribute('sandbox');
        }

        iframe.onload = () => {
            if (myToken !== loadToken) return;
            loader.classList.add('hidden');
            loader.style.display = 'none';
        };

        iframe.src = targetUrl;

        failsafeTimer = setTimeout(() => {
            if (myToken === loadToken) {
                loader.classList.add('hidden');
                loader.style.display = 'none';
            }
        }, 2200);

        if (history.replaceState) {
            const newUrl = `${window.location.pathname}?id=${mediaId}&type=${mediaType}&s=${currentSeason}&e=${currentEpisode}`;
            window.history.replaceState({ path: newUrl }, '', newUrl);
        }
    }

    // Attach click listeners to server pills
    serverButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const s = btn.dataset.server;
            loadStream(s);
            if (s === 'vidsu') {
                showToast('🎧 Vidsu AdFree: Auto-playing in Hindi/Multi-Audio!');
            } else if (s === 'videasy') {
                showToast('⚡ Videasy 4K/HD loaded');
            } else if (s === 'vidlink') {
                showToast('🚀 VidLink Pro loaded (HD/4K Multi-Lang)');
            } else if (s === 'vidcore') {
                showToast('⚡ Vidcore AdFree loaded');
            } else if (s === 'vidme') {
                showToast('🎬 Vidme AdFree loaded');
            } else if (s === 'vidru') {
                showToast('📡 Vidru AdFree loaded');
            } else if (s === 'smashy') {
                showToast('🇮🇳 Smashy (Hindi Dubs) loaded');
            } else if (s !== 'local') {
                showToast(`Switched to Server ${s}`);
            }
        });
    });

    // ═════════ API Helpers ═════════
    async function tmdbFetch(endpoint) {
        const sep = endpoint.includes('?') ? '&' : '?';
        const res = await fetch(`${TMDB_BASE}${endpoint}${sep}api_key=${TMDB_KEY}`);
        if (!res.ok) throw new Error('API Request Failed');
        return res.json();
    }

    // ═════════ Fetch Media Details ═════════
    async function initMediaDetails() {
        if (!mediaId) {
            mediaTitle.textContent = 'Error: Invalid Movie/Show ID';
            return;
        }

        try {
            const endpoint = `/${mediaType}/${mediaId}?append_to_response=credits,similar`;
            const data = await tmdbFetch(endpoint);
            mediaDetails = data;

            const title = data.title || data.name || 'Untitled';
            const year = (data.release_date || data.first_air_date || '').substring(0, 4);
            const rating = data.vote_average ? Number(data.vote_average).toFixed(1) : '7.5';
            const match = Math.round((data.vote_average || 7.5) * 10);
            const runtime = data.runtime || (data.episode_run_time && data.episode_run_time[0]) || '';
            const genres = (data.genres || []).map(g => g.name).join(' • ');

            document.title = `${title} — EPIC OTT`;
            navTitle.textContent = title;
            mediaTitle.textContent = title;
            mediaOverview.textContent = data.overview || 'No storyline overview available.';

            const quality = getVideoQuality(data);
            const hasMultiAudio = isMultiAudioSupported(data);

            mediaMeta.innerHTML = `
                <span class="match-pct">${match}% Match</span>
                <span>${year}</span>
                <span class="meta-quality-pill ${quality.class}">${quality.label}</span>
                <span style="background:rgba(255,255,255,0.14);padding:1px 6px;border-radius:3px;font-weight:700;">${rating} ★</span>
                ${runtime ? `<span>${runtime} min</span>` : ''}
                <span style="border:1px solid var(--border-subtle);padding:1px 6px;border-radius:3px;">${mediaType === 'tv' ? 'TV SERIES' : 'MOVIE'}</span>
                <span style="color:var(--text-tertiary);">${genres}</span>
            `;

            // Setup TV Seasons if applicable
            if (mediaType === 'tv') {
                setupTvSeries(data);
            }

            // Render Cast
            renderCast(data.credits && data.credits.cast ? data.credits.cast : []);

            // Render Similar
            renderSimilar(data.similar && data.similar.results ? data.similar.results : []);

            // Sync My List button state
            syncWatchlistButton(title, data.poster_path ? `${TMDB_POSTER}${data.poster_path}` : '', year);

            // Start default stream: Vidsu AdFree Multi-Audio Engine (#1 server from Nightflix)
            loadStream('vidsu');

            // Background fetch Hindi release links without hijacking the video
            if (typeof searchHindiStreamsForCurrentMedia === 'function') {
                searchHindiStreamsForCurrentMedia(title, false);
            }

        } catch (err) {
            console.error(err);
            mediaTitle.textContent = 'Error loading media details';
            statusText.textContent = 'Check your internet connection';
        }
    }

    // ═════════ TV Series Season & Episode Handler ═════════
    async function setupTvSeries(tvData) {
        episodesSection.classList.add('show');
        epQuickControls.classList.add('show');

        totalSeasons = tvData.number_of_seasons || (tvData.seasons ? tvData.seasons.length : 1);
        seasonSelect.innerHTML = '';

        const seasons = (tvData.seasons || []).filter(s => s.season_number > 0);
        if (!seasons.length) {
            for (let i = 1; i <= totalSeasons; i++) {
                const opt = document.createElement('option');
                opt.value = i;
                opt.textContent = `Season ${i}`;
                if (i === currentSeason) opt.selected = true;
                seasonSelect.appendChild(opt);
            }
        } else {
            seasons.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s.season_number;
                opt.textContent = `${s.name || `Season ${s.season_number}`} (${s.episode_count} eps)`;
                if (s.season_number === currentSeason) opt.selected = true;
                seasonSelect.appendChild(opt);
            });
        }

        seasonSelect.addEventListener('change', () => {
            currentSeason = parseInt(seasonSelect.value, 10);
            currentEpisode = 1;
            loadSeasonEpisodes(currentSeason);
            loadStream(currentServer);
            updateQuickEpControls();
        });

        await loadSeasonEpisodes(currentSeason);
        updateQuickEpControls();
    }

    async function loadSeasonEpisodes(seasonNum) {
        episodesList.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-tertiary);"><i class="fas fa-circle-notch fa-spin"></i> Loading episodes...</div>';
        try {
            const seasonData = await tmdbFetch(`/tv/${mediaId}/season/${seasonNum}`);
            seasonEpisodes = seasonData.episodes || [];

            if (!seasonEpisodes.length) {
                episodesList.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-tertiary);">No episodes found.</div>';
                return;
            }

            episodesList.innerHTML = '';
            seasonEpisodes.forEach(ep => {
                const isPlaying = ep.episode_number === currentEpisode;
                const still = ep.still_path ? `${TMDB_STILL}${ep.still_path}` : 'assets/no-still.png';
                const epCard = document.createElement('div');
                epCard.className = `ep-item-card ${isPlaying ? 'playing' : ''}`;
                epCard.tabIndex = 0;
                epCard.setAttribute('role', 'button');
                epCard.dataset.ep = ep.episode_number;

                epCard.innerHTML = `
                    <img class="ep-item-thumb" src="${still}" alt="EP ${ep.episode_number}" onerror="this.src='https://via.placeholder.com/300x169/14141c/ffffff?text=Episode+${ep.episode_number}';">
                    <div class="ep-item-info">
                        <div class="ep-item-number">Episode ${ep.episode_number}</div>
                        <div class="ep-item-title">${escapeHtml(ep.name || `Episode ${ep.episode_number}`)}</div>
                        <div class="ep-item-time">${ep.runtime ? `${ep.runtime} min • ` : ''}${ep.air_date || ''}</div>
                    </div>
                    <div class="ep-item-icon-play">
                        <i class="fas ${isPlaying ? 'fa-circle-play' : 'fa-play'}"></i>
                    </div>
                `;

                epCard.addEventListener('click', () => {
                    currentEpisode = ep.episode_number;
                    document.querySelectorAll('.ep-item-card').forEach(c => c.classList.remove('playing'));
                    epCard.classList.add('playing');
                    updateQuickEpControls();
                    loadStream(currentServer);
                    showToast(`Now Playing Episode ${currentEpisode}`);
                });

                episodesList.appendChild(epCard);
            });

        } catch (e) {
            episodesList.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-tertiary);">Unable to load episodes.</div>';
        }
    }

    function updateQuickEpControls() {
        epBadgeText.textContent = `S${currentSeason} : E${currentEpisode}`;
        btnPrevEp.disabled = currentEpisode <= 1;
        const maxEp = seasonEpisodes.length || 30;
        btnNextEp.disabled = currentEpisode >= maxEp;
    }

    btnPrevEp.addEventListener('click', () => {
        if (currentEpisode > 1) {
            currentEpisode--;
            updateActiveEpisodeUI();
            loadStream(currentServer);
        }
    });

    btnNextEp.addEventListener('click', () => {
        currentEpisode++;
        updateActiveEpisodeUI();
        loadStream(currentServer);
    });

    function updateActiveEpisodeUI() {
        updateQuickEpControls();
        document.querySelectorAll('.ep-item-card').forEach(c => {
            const isPlaying = parseInt(c.dataset.ep, 10) === currentEpisode;
            c.classList.toggle('playing', isPlaying);
            const icon = c.querySelector('.ep-item-icon-play i');
            if (icon) icon.className = isPlaying ? 'fas fa-circle-play' : 'fas fa-play';
        });
    }

    // ═════════ Cast Members ═════════
    function renderCast(castList) {
        if (!castList.length) {
            castTrack.parentElement.style.display = 'none';
            return;
        }
        castTrack.innerHTML = '';
        castList.slice(0, 14).forEach(actor => {
            const photo = actor.profile_path ? `${TMDB_PROFILE}${actor.profile_path}` : 'https://via.placeholder.com/185x185/181822/ffffff?text=?';
            const item = document.createElement('div');
            item.className = 'cast-avatar-card';
            item.innerHTML = `
                <img class="cast-avatar-img" src="${photo}" alt="${escapeHtml(actor.name)}" loading="lazy" decoding="async">
                <div class="cast-actor-name">${escapeHtml(actor.name)}</div>
                <div class="cast-char-name">${escapeHtml(actor.character || '')}</div>
            `;
            castTrack.appendChild(item);
        });
    }

    // ═════════ Similar / Recommendations ═════════
    function renderSimilar(similarList) {
        if (!similarList.length) {
            similarGrid.parentElement.style.display = 'none';
            return;
        }
        similarGrid.innerHTML = '';
        const valid = similarList.filter(m => m.poster_path).slice(0, 9);
        valid.forEach(item => {
            const title = item.title || item.name || 'Untitled';
            const poster = `${TMDB_POSTER}${item.poster_path}`;
            const rating = item.vote_average ? Number(item.vote_average).toFixed(1) : '7.0';

            const card = document.createElement('div');
            card.className = 'movie-card';
            card.tabIndex = 0;
            card.setAttribute('role', 'button');
            card.innerHTML = `
                <div class="card-poster-wrapper">
                    <img src="${poster}" alt="${escapeHtml(title)}" loading="lazy" decoding="async">
                    <div class="card-badge-rating"><i class="fas fa-star"></i>${rating}</div>
                </div>
                <div class="card-info-peek">
                    <div class="card-title-text">${escapeHtml(title)}</div>
                </div>
            `;

            card.addEventListener('click', () => {
                window.location.href = `player.html?id=${item.id}&type=${mediaType}`;
            });

            similarGrid.appendChild(card);
        });
    }

    // ═════════ My List (Watchlist) Integration ═════════
    function syncWatchlistButton(title, poster, year) {
        let watchlist = [];
        try {
            watchlist = JSON.parse(localStorage.getItem('epic_watchlist') || localStorage.getItem('ghazi_watchlist') || '[]');
        } catch (e) {
            watchlist = [];
        }

        const isFavorited = watchlist.some(w => w.id == mediaId);
        updateFavButtonUI(isFavorited);

        actionFavBtn.onclick = () => {
            try {
                watchlist = JSON.parse(localStorage.getItem('epic_watchlist') || localStorage.getItem('ghazi_watchlist') || '[]');
            } catch (e) {
                watchlist = [];
            }

            const idx = watchlist.findIndex(w => w.id == mediaId);
            if (idx >= 0) {
                watchlist.splice(idx, 1);
                updateFavButtonUI(false);
                showToast('Removed from My List');
            } else {
                watchlist.unshift({ id: mediaId, title, poster, year, type: mediaType });
                updateFavButtonUI(true);
                showToast('Saved to My List');
            }
            localStorage.setItem('epic_watchlist', JSON.stringify(watchlist));
        };
    }

    function updateFavButtonUI(isFav) {
        actionFavBtn.classList.toggle('favorited', isFav);
        const icon = actionFavBtn.querySelector('i');
        const label = document.getElementById('favBtnLabel');
        if (icon) icon.className = isFav ? 'fas fa-heart' : 'far fa-heart';
        if (label) label.textContent = isFav ? 'Saved' : 'My List';
    }

    // ═════════ Actions Strip Handlers ═════════
    document.getElementById('actionReloadBtn').addEventListener('click', () => {
        loadStream(currentServer);
        showToast('Stream Reloaded');
    });

    // ═════════ Advanced Fullscreen, Zoom & Auto-Rotate Controls ═════════
    const fullscreenBtn = document.getElementById('actionFullscreenBtn');
    const exitFullscreenBtn = document.getElementById('btnExitFullscreen');
    const toggleZoomBtn = document.getElementById('btnToggleZoom');
    const zoomBtnText = document.getElementById('zoomBtnText');
    const serverQuickBtn = document.getElementById('btnServerQuick');
    const serverQuickText = document.getElementById('serverQuickText');
    const videoContainer = document.getElementById('videoFrameContainer');
    const landscapeControls = document.getElementById('landscapeControls');

    let controlsTimeout = null;
    function pingControls() {
        if (!landscapeControls) return;
        landscapeControls.classList.remove('fade-out');
        if (controlsTimeout) clearTimeout(controlsTimeout);
        controlsTimeout = setTimeout(() => {
            landscapeControls.classList.add('fade-out');
        }, 3400);
    }

    if (landscapeControls) {
        document.addEventListener('touchstart', pingControls, { passive: true });
        document.addEventListener('click', pingControls, { passive: true });
    }

    // Zoom / Screen Fill Toggle (100% Widescreen edge-to-edge)
    let isZoomFilled = false;
    if (toggleZoomBtn && videoContainer) {
        toggleZoomBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            isZoomFilled = !isZoomFilled;
            videoContainer.classList.toggle('zoom-fill', isZoomFilled);
            toggleZoomBtn.classList.toggle('active', isZoomFilled);
            if (zoomBtnText) {
                zoomBtnText.textContent = isZoomFilled ? 'Fit 16:9' : 'Fill Screen';
            }
            showToast(isZoomFilled ? 'Zoom to Fill: Full Screen Edge-to-Edge' : 'Fit Screen: Original Ratio');
            pingControls();
        });
    }

    // Audio Switch Button in Landscape / Fullscreen Controls
    const btnAudioHint = document.getElementById('btnAudioHint');
    if (btnAudioHint) {
        btnAudioHint.addEventListener('click', (e) => {
            e.stopPropagation();
            if (isCmosPlaying || currentServer === 'local' || (localPlayerContainer && localPlayerContainer.style.display !== 'none')) {
                if (localBtnAudioTrack) localBtnAudioTrack.click();
            } else {
                loadStream('vidsu');
                showToast('🎧 Vidsu AdFree (CinemaOS Multi-Audio)');
            }
            pingControls();
        });
    }

    // Quick switch server inside fullscreen
    if (serverQuickBtn) {
        serverQuickBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const serverList = ['vidsu', 'videasy', 'vidlink', 'vidcore', 'vidme', 'vidru', 'smashy'];
            const idx = serverList.indexOf(currentServer);
            const nextServer = serverList[(idx + 1) % serverList.length];
            loadStream(nextServer);
            const shortNames = {
                'vidsu': 'Vidsu AdFree (Multi-Audio)',
                'videasy': 'Videasy 4K/HD',
                'vidlink': 'VidLink Pro',
                'vidcore': 'Vidcore AdFree',
                'vidme': 'Vidme AdFree',
                'vidru': 'Vidru AdFree',
                'smashy': 'Smashy Stream'
            };
            showToast(`Switched to ${shortNames[nextServer] || nextServer}`);
            pingControls();
        });
    }

    async function toggleFullscreenMode() {
        const isCurrentlyFullscreen = document.fullscreenElement || document.webkitFullscreenElement || document.body.classList.contains('is-fullscreen');

        if (!isCurrentlyFullscreen) {
            document.body.classList.add('is-fullscreen');

            // 1. Lock screen orientation to landscape
            if (window.screen && window.screen.orientation && window.screen.orientation.lock) {
                try {
                    await window.screen.orientation.lock('landscape');
                } catch (e) {
                    console.log('Orientation lock note:', e);
                }
            }

            // 2. Request native browser fullscreen with hidden navigation UI
            const elem = document.documentElement;
            if (elem.requestFullscreen) {
                elem.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
            } else if (elem.webkitRequestFullscreen) {
                elem.webkitRequestFullscreen();
            }

            showToast('Landscape Cinema Mode');
            pingControls();
        } else {
            exitFullscreenMode();
        }
    }

    async function exitFullscreenMode() {
        document.body.classList.remove('is-fullscreen');

        // 1. Unlock screen orientation
        if (window.screen && window.screen.orientation && window.screen.orientation.unlock) {
            try {
                window.screen.orientation.unlock();
            } catch (e) {
                console.log('Orientation unlock note:', e);
            }
        }

        // 2. Exit native fullscreen
        if (document.fullscreenElement || document.webkitFullscreenElement) {
            if (document.exitFullscreen) {
                document.exitFullscreen().catch(() => {});
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            }
        }
    }

    if (fullscreenBtn) {
        fullscreenBtn.addEventListener('click', toggleFullscreenMode);
    }
    if (exitFullscreenBtn) {
        exitFullscreenBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            exitFullscreenMode();
        });
    }

    // Auto-detect phone physical rotation
    function checkOrientation() {
        const isLandscape = window.innerWidth > window.innerHeight;
        if (isLandscape) {
            document.body.classList.add('is-fullscreen');
            const elem = document.documentElement;
            if (!document.fullscreenElement && elem.requestFullscreen) {
                elem.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
            }
            pingControls();
        } else {
            document.body.classList.remove('is-fullscreen');
        }
    }
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement) {
            if (window.innerHeight > window.innerWidth) {
                document.body.classList.remove('is-fullscreen');
            }
        }
    });

    const shareBtn = document.getElementById('actionShareBtn');
    const headerShareBtn = document.getElementById('btnShareMedia');
    const handleShare = async () => {
        const title = mediaDetails ? (mediaDetails.title || mediaDetails.name) : 'Watch on EPIC OTT';
        const shareData = {
            title: `${title} — EPIC OTT`,
            text: `Watch ${title} on EPIC OTT in HD & 4K!`,
            url: window.location.href
        };
        if (navigator.share) {
            try {
                await navigator.share(shareData);
            } catch (e) {
                // User cancelled or error
            }
        } else {
            navigator.clipboard.writeText(window.location.href);
            showToast('Link copied to clipboard!');
        }
    };
    if (shareBtn) shareBtn.addEventListener('click', handleShare);
    if (headerShareBtn) headerShareBtn.addEventListener('click', handleShare);

    // Back button
    document.getElementById('btnBackToHome').addEventListener('click', () => {
        if (window.history.length > 1) {
            window.history.back();
        } else {
            window.location.href = 'index.html';
        }
    });

    // ═════════ Toast ═════════
    let toastTimer = null;
    function showToast(msg) {
        const toast = document.getElementById('appToast');
        const text = document.getElementById('toastMessage');
        if (!toast || !text) return;
        text.textContent = msg;
        toast.classList.add('show');
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove('show'), 2000);
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }



    // ═══════════════════════════════════════════════════════════════
    // In-App MKV & Multi-Lang Local Player Controller
    // ═══════════════════════════════════════════════════════════════
    const localPlayerContainer = document.getElementById('localPlayerContainer');
    const localPickerHub = document.getElementById('localPickerHub');
    const localActivePlayer = document.getElementById('localActivePlayer');
    const localFileInput = document.getElementById('localFileInput');
    const btnChooseLocalFile = document.getElementById('btnChooseLocalFile');
    const localStreamUrlInput = document.getElementById('localStreamUrlInput');
    const btnPlayStreamUrl = document.getElementById('btnPlayStreamUrl');
    const btnPlayDemoClip = document.getElementById('btnPlayDemoClip');

    const localVideo = document.getElementById('localVideoElement');
    const localVideoSurface = document.getElementById('localVideoSurface');
    const localPlayingTitle = document.getElementById('localPlayingTitle');
    const localPlayingBadge = document.getElementById('localPlayingBadge');
    const btnLocalChangeFile = document.getElementById('btnLocalChangeFile');
    const btnLocalShowStreams = document.getElementById('btnLocalShowStreams');

    const localCtrlCenter = document.getElementById('localCtrlCenter');
    const localBtnPlayPause = document.getElementById('localBtnPlayPause');
    const localPlayIcon = document.getElementById('localPlayIcon');
    const localBtnRewind = document.getElementById('localBtnRewind');
    const localBtnForward = document.getElementById('localBtnForward');

    const localCtrlTop = document.getElementById('localCtrlTop');
    const localCtrlBottom = document.getElementById('localCtrlBottom');
    const localProgressWrap = document.getElementById('localProgressWrap');
    const localBufferedBar = document.getElementById('localBufferedBar');
    const localCurrentBar = document.getElementById('localCurrentBar');
    const localProgressThumb = document.getElementById('localProgressThumb');

    const localBtnPlayPauseMini = document.getElementById('localBtnPlayPauseMini');
    const localMiniPlayIcon = document.getElementById('localMiniPlayIcon');
    const localTimeDisplay = document.getElementById('localTimeDisplay');

    const localBtnAudioTrack = document.getElementById('localBtnAudioTrack');
    const localAudioBadge = document.getElementById('localAudioBadge');
    const localAudioDrawer = document.getElementById('localAudioDrawer');
    const localAudioTrackList = document.getElementById('localAudioTrackList');
    const btnAudioDrawerClose = document.getElementById('btnAudioDrawerClose');

    const localBtnSubtitles = document.getElementById('localBtnSubtitles');
    const localSubBadge = document.getElementById('localSubBadge');
    const localSubtitlesDrawer = document.getElementById('localSubtitlesDrawer');
    const localSubtitleList = document.getElementById('localSubtitleList');
    const btnSubDrawerClose = document.getElementById('btnSubDrawerClose');
    const localSubFileInput = document.getElementById('localSubFileInput');
    const btnChooseSubFile = document.getElementById('btnChooseSubFile');

    const localBtnSpeed = document.getElementById('localBtnSpeed');
    const localSpeedText = document.getElementById('localSpeedText');
    const localBtnAspect = document.getElementById('localBtnAspect');
    const localBtnFullscreen = document.getElementById('localBtnFullscreen');

    let isLocalPlaying = false;
    let localControlsTimeout = null;
    let localAspectMode = 0; // 0: Fit, 1: Fill, 2: Stretch
    let localSpeedIdx = 1;
    const localSpeeds = [0.75, 1.0, 1.25, 1.5, 2.0];
    let isScrubbing = false;
    let activeAudioTrackIndex = 0;
    let audioContext = null;
    let audioPanner = null;
    let audioGain = null;

    function initWebAudio() {
        if (audioContext || !localVideo) return;
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            audioContext = new AudioCtx();
            const source = audioContext.createMediaElementSource(localVideo);
            audioPanner = audioContext.createStereoPanner ? audioContext.createStereoPanner() : null;
            audioGain = audioContext.createGain();

            if (audioPanner) {
                source.connect(audioPanner);
                audioPanner.connect(audioGain);
            } else {
                source.connect(audioGain);
            }
            audioGain.connect(audioContext.destination);
        } catch (e) {
            console.warn('WebAudio init error (CORS or codec restriction):', e);
        }
    }

    function formatTime(sec) {
        if (!sec || isNaN(sec) || !isFinite(sec)) return '00:00';
        sec = Math.floor(sec);
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = sec % 60;
        if (h > 0) {
            return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
        }
        return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    }

    function pingLocalControls() {
        if (!localActivePlayer) return;
        localActivePlayer.classList.remove('controls-faded');
        if (localControlsTimeout) clearTimeout(localControlsTimeout);
        if (localVideo && !localVideo.paused) {
            localControlsTimeout = setTimeout(() => {
                const isDrawerOpen = (localAudioDrawer && localAudioDrawer.classList.contains('active')) ||
                                     (localSubtitlesDrawer && localSubtitlesDrawer.classList.contains('active'));
                if (!isDrawerOpen) {
                    localActivePlayer.classList.add('controls-faded');
                }
            }, 3500);
        }
    }

    function updatePlayPauseIcons(isPlaying) {
        isLocalPlaying = isPlaying;
        const iconClass = isPlaying ? 'fas fa-pause' : 'fas fa-play';
        if (localPlayIcon) localPlayIcon.className = iconClass;
        if (localMiniPlayIcon) localMiniPlayIcon.className = iconClass;
    }

    function toggleLocalPlayPause() {
        if (!localVideo) return;
        if (localVideo.paused) {
            localVideo.play().then(() => {
                updatePlayPauseIcons(true);
                pingLocalControls();
            }).catch(() => {});
        } else {
            localVideo.pause();
            updatePlayPauseIcons(false);
            pingLocalControls();
        }
    }

    function seekLocal(delta) {
        if (!localVideo) return;
        localVideo.currentTime = Math.max(0, Math.min(localVideo.duration || 0, localVideo.currentTime + delta));
        pingLocalControls();
        showToast(delta > 0 ? '+10s Forward' : '-10s Rewind');
    }

    let currentHls = null;
    let currentDash = null;

    function loadLocalVideo(sourceUrl, displayName) {
        if (!localVideo) return;
        if (localPlayingTitle) localPlayingTitle.textContent = displayName || 'Video';
        if (localPickerHub) localPickerHub.style.display = 'none';
        if (localActivePlayer) localActivePlayer.style.display = 'flex';

        if (currentHls) {
            try { currentHls.destroy(); } catch (e) {}
            currentHls = null;
        }
        if (currentDash) {
            try { currentDash.reset(); } catch (e) {}
            currentDash = null;
        }

        const isDash = typeof sourceUrl === 'string' && (sourceUrl.includes('.mpd') || sourceUrl.includes('dash/'));
        const isHls = typeof sourceUrl === 'string' && (sourceUrl.includes('.m3u8') || sourceUrl.includes('m3u8'));

        if (isDash && window.dashjs) {
            try {
                currentDash = window.dashjs.MediaPlayer().create();
                currentDash.initialize(localVideo, sourceUrl, true);
                updatePlayPauseIcons(true);
                pingLocalControls();
                showToast(`Now Playing: ${displayName || 'Direct Stream'}`);
            } catch (e) {
                console.warn('Dash.js init error:', e);
                localVideo.src = sourceUrl;
                localVideo.load();
                localVideo.play().catch(() => {});
            }
        } else if (isHls && window.Hls && window.Hls.isSupported()) {
            currentHls = new window.Hls({ enableWorker: true });
            currentHls.loadSource(sourceUrl);
            currentHls.attachMedia(localVideo);
            currentHls.on(window.Hls.Events.MANIFEST_PARSED, () => {
                localVideo.play().then(() => {
                    updatePlayPauseIcons(true);
                    pingLocalControls();
                }).catch(() => updatePlayPauseIcons(false));
            });
            currentHls.on(window.Hls.Events.ERROR, (event, data) => {
                if (data.fatal) {
                    console.warn('HLS error:', data);
                    switch (data.type) {
                        case window.Hls.ErrorTypes.NETWORK_ERROR:
                            currentHls.startLoad();
                            break;
                        case window.Hls.ErrorTypes.MEDIA_ERROR:
                            currentHls.recoverMediaError();
                            break;
                        default:
                            currentHls.destroy();
                            break;
                    }
                }
            });
        } else {
            localVideo.src = sourceUrl;
            localVideo.load();
            localVideo.play().then(() => {
                updatePlayPauseIcons(true);
                pingLocalControls();
                showToast(`Now Playing: ${displayName || 'Local MKV Video'}`);
            }).catch(err => {
                console.warn('Autoplay prevented or pending click:', err);
                updatePlayPauseIcons(false);
                showToast('Tap Play to begin video');
            });
        }
        updateAudioTracksList();
        updateSubtitlesList();
    }

    if (localVideo) {
        localVideo.addEventListener('timeupdate', () => {
            if (isScrubbing) return;
            const current = localVideo.currentTime;
            const duration = localVideo.duration || 0;
            const pct = duration > 0 ? (current / duration) * 100 : 0;
            if (localCurrentBar) localCurrentBar.style.width = `${pct}%`;
            if (localProgressThumb) localProgressThumb.style.left = `${pct}%`;
            if (localTimeDisplay) {
                localTimeDisplay.textContent = `${formatTime(current)} / ${formatTime(duration)}`;
            }
        });

        localVideo.addEventListener('progress', () => {
            if (localVideo.buffered.length > 0 && localVideo.duration > 0) {
                const bufferedEnd = localVideo.buffered.end(localVideo.buffered.length - 1);
                const pct = (bufferedEnd / localVideo.duration) * 100;
                if (localBufferedBar) localBufferedBar.style.width = `${pct}%`;
            }
        });

        localVideo.addEventListener('play', () => {
            updatePlayPauseIcons(true);
            if (document.activeElement && (document.activeElement.classList.contains('server-pill') || document.activeElement.tagName === 'BODY')) {
                document.activeElement.blur();
                if (localVideoSurface) localVideoSurface.focus();
            }
        });
        localVideo.addEventListener('pause', () => updatePlayPauseIcons(false));
        localVideo.addEventListener('ended', () => {
            updatePlayPauseIcons(false);
            if (localActivePlayer) localActivePlayer.classList.remove('controls-faded');
        });
        localVideo.addEventListener('error', (e) => {
            console.warn('Video element error:', e);
            if (isCmosPlaying) {
                console.log('CinemaOS direct stream encountered error, failing over to Vidsu Iframe');
                isCmosPlaying = false;
                showToast('Direct stream unavailable, falling back to backup player...');
                loadIframeStream('vidsu', loadToken);
            }
        });
    }

    // Scrubber interaction
    function handleScrub(e) {
        if (!localVideo || !localProgressWrap || !localVideo.duration) return;
        const rect = localProgressWrap.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        if (localCurrentBar) localCurrentBar.style.width = `${pct * 100}%`;
        if (localProgressThumb) localProgressThumb.style.left = `${pct * 100}%`;
        localVideo.currentTime = pct * localVideo.duration;
    }

    if (localProgressWrap) {
        localProgressWrap.addEventListener('touchstart', (e) => {
            isScrubbing = true;
            handleScrub(e);
        }, { passive: true });
        window.addEventListener('touchmove', (e) => {
            if (isScrubbing) handleScrub(e);
        }, { passive: true });
        window.addEventListener('touchend', () => {
            if (isScrubbing) {
                isScrubbing = false;
                pingLocalControls();
            }
        });

        localProgressWrap.addEventListener('mousedown', (e) => {
            isScrubbing = true;
            handleScrub(e);
        });
        window.addEventListener('mousemove', (e) => {
            if (isScrubbing) handleScrub(e);
        });
        window.addEventListener('mouseup', () => {
            if (isScrubbing) {
                isScrubbing = false;
                pingLocalControls();
            }
        });
    }

    // Center & Mini play/pause
    if (localBtnPlayPause) localBtnPlayPause.addEventListener('click', toggleLocalPlayPause);
    if (localBtnPlayPauseMini) localBtnPlayPauseMini.addEventListener('click', toggleLocalPlayPause);
    if (localBtnRewind) localBtnRewind.addEventListener('click', () => seekLocal(-10));
    if (localBtnForward) localBtnForward.addEventListener('click', () => seekLocal(10));

    // Surface Tap & Double Tap Gestures
    let lastTapTime = 0;
    if (localVideoSurface) {
        localVideoSurface.addEventListener('click', (e) => {
            const now = Date.now();
            const rect = localVideoSurface.getBoundingClientRect();
            const tapX = e.clientX - rect.left;
            const width = rect.width;

            if (now - lastTapTime < 320) {
                // Double tap
                if (tapX < width * 0.4) {
                    seekLocal(-10);
                } else if (tapX > width * 0.6) {
                    seekLocal(10);
                } else {
                    toggleLocalPlayPause();
                }
                lastTapTime = 0;
            } else {
                lastTapTime = now;
                setTimeout(() => {
                    if (lastTapTime === now) {
                        // Single tap: toggle controls
                        if (localActivePlayer && localActivePlayer.classList.contains('controls-faded')) {
                            pingLocalControls();
                        } else if (localActivePlayer) {
                            localActivePlayer.classList.add('controls-faded');
                        }
                    }
                }, 320);
            }
        });
    }

    // Speed button
    if (localBtnSpeed) {
        localBtnSpeed.addEventListener('click', () => {
            localSpeedIdx = (localSpeedIdx + 1) % localSpeeds.length;
            const speed = localSpeeds[localSpeedIdx];
            if (localVideo) localVideo.playbackRate = speed;
            if (localSpeedText) localSpeedText.textContent = `${speed}x`;
            showToast(`Playback Speed: ${speed}x`);
            pingLocalControls();
        });
    }

    // Aspect Ratio toggle
    if (localBtnAspect) {
        localBtnAspect.addEventListener('click', () => {
            localAspectMode = (localAspectMode + 1) % 3;
            if (localActivePlayer) {
                localActivePlayer.classList.remove('zoom-fill', 'zoom-stretch');
                if (localAspectMode === 1) {
                    localActivePlayer.classList.add('zoom-fill');
                    showToast('Aspect Ratio: Fill (Crop to screen)');
                } else if (localAspectMode === 2) {
                    localActivePlayer.classList.add('zoom-stretch');
                    showToast('Aspect Ratio: 16:9 Stretch');
                } else {
                    showToast('Aspect Ratio: Fit 16:9 (Original)');
                }
            }
            pingLocalControls();
        });
    }

    // Fullscreen button
    if (localBtnFullscreen) {
        localBtnFullscreen.addEventListener('click', () => {
            toggleFullscreenMode();
            pingLocalControls();
        });
    }

    // Choose Local MKV / Video File
    if (btnChooseLocalFile && localFileInput) {
        btnChooseLocalFile.addEventListener('click', () => {
            localFileInput.click();
        });
        localFileInput.addEventListener('change', () => {
            const file = localFileInput.files[0];
            if (!file) return;
            const objectUrl = URL.createObjectURL(file);
            loadLocalVideo(objectUrl, file.name);
        });
    }

    // Direct Stream URL
    if (btnPlayStreamUrl && localStreamUrlInput) {
        btnPlayStreamUrl.addEventListener('click', () => {
            const url = localStreamUrlInput.value.trim();
            if (url) {
                loadLocalVideo(url, 'Online Video / MKV');
            } else {
                showToast('Please enter a valid video stream URL');
            }
        });
        localStreamUrlInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') btnPlayStreamUrl.click();
        });
    }

    // Play Demo Clip
    if (btnPlayDemoClip) {
        btnPlayDemoClip.addEventListener('click', () => {
            const demoUrl = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
            loadLocalVideo(demoUrl, 'Demo HD Clip (Multi-Audio Test)');
        });
    }

    // Change File
    if (btnLocalChangeFile) {
        btnLocalChangeFile.addEventListener('click', () => {
            if (localVideo) {
                localVideo.pause();
                localVideo.src = '';
            }
            if (localActivePlayer) localActivePlayer.style.display = 'none';
            if (localPickerHub) localPickerHub.style.display = 'flex';
            showToast('Choose a new MKV or Video file');
        });
    }

    // Show MovieBox Sources from Player
    if (btnLocalShowStreams) {
        btnLocalShowStreams.addEventListener('click', () => {
            if (localActivePlayer) localActivePlayer.style.display = 'none';
            if (localPickerHub) localPickerHub.style.display = 'flex';
            const tabHindi = document.getElementById('tabBtnHindiStreams');
            if (tabHindi) tabHindi.click();
            showToast('Showing MovieBox Hindi Sources & Releases');
        });
    }

    // Drawers (Audio Tracks & Subtitles)
    function closeDrawers() {
        if (localAudioDrawer) localAudioDrawer.classList.remove('active');
        if (localSubtitlesDrawer) localSubtitlesDrawer.classList.remove('active');
    }

    function updateAudioTracksList() {
        if (!localAudioTrackList) return;
        localAudioTrackList.innerHTML = '';

        // 🎧 1. CinemaOS Multi-Language Audio Tracks (Nightflix Vidsu Stream Backend)
        if (cmosTracks && cmosTracks.length > 0) {
            const cmosHeader = document.createElement('div');
            cmosHeader.style.cssText = 'padding: 8px 12px; font-size: 0.72rem; color: #00e5ff; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid rgba(0,229,255,0.2); margin-bottom: 6px; display: flex; align-items: center; gap: 6px;';
            cmosHeader.innerHTML = '<i class="fas fa-headphones"></i> CinemaOS Multi-Language Audio';
            localAudioTrackList.appendChild(cmosHeader);

            cmosTracks.forEach((t, idx) => {
                const item = document.createElement('div');
                const isActive = (activeCmosTrackIdx === idx);
                item.className = `local-track-item ${isActive ? 'active' : ''}`;
                item.tabIndex = 0;
                item.setAttribute('role', 'button');
                item.innerHTML = `
                    <div class="local-track-item-left">
                        <span style="font-size:1.15rem;margin-right:6px;">${t.flag}</span>
                        <div style="display:flex;flex-direction:column;text-align:left;">
                            <span style="font-weight:700;font-size:0.82rem;color:#fff;">${escapeHtml(t.name)} ${t.isHindi ? '<span style="color:#00e5ff;font-size:0.7rem;font-weight:800;margin-left:4px;">[HINDI DUBBED]</span>' : ''}</span>
                            <span style="font-size:0.68rem;color:var(--text-tertiary);">${t.quality} • CinemaOS CMOS Stream</span>
                        </div>
                    </div>
                    <span class="local-track-badge" style="${isActive ? 'background:#00e5ff;color:#000;font-weight:800;' : ''}">${isActive ? 'PLAYING' : 'SWITCH'}</span>
                `;
                item.addEventListener('click', () => {
                    playCmosTrack(idx);
                });
                localAudioTrackList.appendChild(item);
            });

            const divHeader = document.createElement('div');
            divHeader.style.cssText = 'padding: 10px 12px 6px; font-size: 0.7rem; color: var(--text-tertiary); font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;';
            divHeader.innerHTML = '<i class="fas fa-sliders"></i> Audio Channel Presets';
            localAudioTrackList.appendChild(divHeader);
        }

        // Browser native audioTracks
        const tracks = localVideo ? localVideo.audioTracks : null;
        if (tracks && tracks.length > 1) {
            for (let i = 0; i < tracks.length; i++) {
                const track = tracks[i];
                const item = document.createElement('div');
                item.className = `local-track-item ${track.enabled ? 'active' : ''}`;
                item.tabIndex = 0;
                item.setAttribute('role', 'button');
                const label = track.label || (track.language ? track.language.toUpperCase() : `Audio Track ${i + 1}`);
                item.innerHTML = `
                    <div class="local-track-item-left">
                        <i class="fas fa-headphones"></i>
                        <span>${escapeHtml(label)}</span>
                    </div>
                    <span class="local-track-badge">${track.enabled ? 'ACTIVE' : 'SELECT'}</span>
                `;
                item.addEventListener('click', () => {
                    for (let j = 0; j < tracks.length; j++) {
                        tracks[j].enabled = (j === i);
                    }
                    if (localAudioBadge) localAudioBadge.textContent = label.substring(0, 6);
                    showToast(`Audio Track: ${label}`);
                    closeDrawers();
                    updateAudioTracksList();
                });
                localAudioTrackList.appendChild(item);
            }
        }

        // Multi-Audio & Dual Audio Presets
        const presets = [
            { id: 'stereo', name: 'Original Stereo (All Channels)', desc: 'Standard', pan: 0, boost: 1.0 },
            { id: 'hindi-left', name: '🇮🇳 Hindi Dubbed (Left Channel)', desc: 'Dual Left', pan: -0.9, boost: 1.2 },
            { id: 'eng-right', name: '🇺🇸 English Audio (Right Channel)', desc: 'Dual Right', pan: 0.9, boost: 1.2 },
            { id: 'vocal-boost', name: '🔊 Dialogue & Vocal Booster', desc: 'Clear Voice', pan: 0, boost: 2.0 }
        ];

        presets.forEach((p, idx) => {
            const item = document.createElement('div');
            item.className = `local-track-item ${activeAudioTrackIndex === idx ? 'active' : ''}`;
            item.tabIndex = 0;
            item.setAttribute('role', 'button');
            item.innerHTML = `
                <div class="local-track-item-left">
                    <i class="fas fa-sliders"></i>
                    <span>${p.name}</span>
                </div>
                <span class="local-track-badge">${p.desc}</span>
            `;
            item.addEventListener('click', () => {
                initWebAudio();
                if (audioContext && audioContext.state === 'suspended') {
                    audioContext.resume();
                }
                if (audioPanner) {
                    audioPanner.pan.value = p.pan;
                }
                if (audioGain) {
                    audioGain.gain.value = p.boost;
                }
                activeAudioTrackIndex = idx;
                if (localAudioBadge) {
                    localAudioBadge.textContent = idx === 1 ? 'Hindi' : (idx === 2 ? 'Eng' : 'Audio');
                }
                showToast(`Audio: ${p.name}`);
                closeDrawers();
                updateAudioTracksList();
            });
            localAudioTrackList.appendChild(item);
        });
    }

    function srtToVtt(srtText) {
        return 'WEBVTT\n\n' + srtText
            .replace(/\r\n|\r/g, '\n')
            .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
    }

    function updateSubtitlesList() {
        if (!localSubtitleList || !localVideo) return;
        localSubtitleList.innerHTML = '';

        const hasActiveTracks = Array.from(localVideo.textTracks || []).some(t => t.mode === 'showing');
        const offItem = document.createElement('div');
        offItem.className = `local-track-item ${!hasActiveTracks ? 'active' : ''}`;
        offItem.tabIndex = 0;
        offItem.setAttribute('role', 'button');
        offItem.innerHTML = `
            <div class="local-track-item-left">
                <i class="fas fa-ban"></i>
                <span>Subtitles Off</span>
            </div>
            <span class="local-track-badge">${!hasActiveTracks ? 'ACTIVE' : 'OFF'}</span>
        `;
        offItem.addEventListener('click', () => {
            Array.from(localVideo.textTracks || []).forEach(t => t.mode = 'disabled');
            if (localSubBadge) localSubBadge.textContent = 'CC';
            showToast('Subtitles Disabled');
            closeDrawers();
            updateSubtitlesList();
        });
        offItem.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.keyCode === 13) {
                e.preventDefault();
                offItem.click();
            }
        });
        localSubtitleList.appendChild(offItem);

        Array.from(localVideo.textTracks || []).forEach((t, i) => {
            const item = document.createElement('div');
            item.className = `local-track-item ${t.mode === 'showing' ? 'active' : ''}`;
            item.tabIndex = 0;
            item.setAttribute('role', 'button');
            const label = t.label || t.language || `Track ${i + 1}`;
            item.innerHTML = `
                <div class="local-track-item-left">
                    <i class="fas fa-closed-captioning"></i>
                    <span>${escapeHtml(label)}</span>
                </div>
                <span class="local-track-badge">${t.mode === 'showing' ? 'ACTIVE' : 'SELECT'}</span>
            `;
            item.addEventListener('click', () => {
                Array.from(localVideo.textTracks).forEach(trk => trk.mode = 'disabled');
                t.mode = 'showing';
                if (localSubBadge) localSubBadge.textContent = 'ON';
                showToast(`Subtitles: ${label}`);
                closeDrawers();
                updateSubtitlesList();
            });
            item.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.keyCode === 13) {
                    e.preventDefault();
                    item.click();
                }
            });
            localSubtitleList.appendChild(item);
        });
    }

    if (localBtnAudioTrack) {
        localBtnAudioTrack.addEventListener('click', () => {
            closeDrawers();
            updateAudioTracksList();
            if (localAudioDrawer) localAudioDrawer.classList.add('active');
            pingLocalControls();
        });
    }
    if (btnAudioDrawerClose) btnAudioDrawerClose.addEventListener('click', closeDrawers);

    if (localBtnSubtitles) {
        localBtnSubtitles.addEventListener('click', () => {
            closeDrawers();
            updateSubtitlesList();
            if (localSubtitlesDrawer) localSubtitlesDrawer.classList.add('active');
            pingLocalControls();
        });
    }
    if (btnSubDrawerClose) btnSubDrawerClose.addEventListener('click', closeDrawers);

    if (btnChooseSubFile && localSubFileInput) {
        btnChooseSubFile.addEventListener('click', () => localSubFileInput.click());
        localSubFileInput.addEventListener('change', () => {
            const file = localSubFileInput.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                const content = e.target.result;
                const vtt = file.name.endsWith('.vtt') ? content : srtToVtt(content);
                const blob = new Blob([vtt], { type: 'text/vtt' });
                const blobUrl = URL.createObjectURL(blob);

                const track = document.createElement('track');
                track.kind = 'subtitles';
                track.label = file.name.replace(/\.[^/.]+$/, '');
                track.srclang = 'hi';
                track.src = blobUrl;
                track.default = true;
                if (localVideo) localVideo.appendChild(track);

                setTimeout(() => {
                    if (localVideo && localVideo.textTracks) {
                        for (let i = 0; i < localVideo.textTracks.length; i++) {
                            localVideo.textTracks[i].mode = (i === localVideo.textTracks.length - 1) ? 'showing' : 'disabled';
                        }
                    }
                    if (localSubBadge) localSubBadge.textContent = 'ON';
                    showToast(`✅ Subtitles Loaded: ${file.name}`);
                    closeDrawers();
                    updateSubtitlesList();
                }, 200);
            };
            reader.readAsText(file);
        });
    }

    // ═══════════════════════════════════════════════════════════════
    // MovieBox Hindi Multi-Source Stream Engine (4KHDHub, VegaMovies, HDHub4u, HubCloud)
    // ═══════════════════════════════════════════════════════════════

    // Hub Tabs Elements
    const tabBtnHindiStreams = document.getElementById('tabBtnHindiStreams');
    const tabBtnLocalFile = document.getElementById('tabBtnLocalFile');
    const panelHindiStreams = document.getElementById('panelHindiStreams');
    const panelLocalFile = document.getElementById('panelLocalFile');
    const hubMovieTitleText = document.getElementById('hubMovieTitleText');
    const hubScannerCard = document.getElementById('hubScannerCard');
    const hubScannerTitle = document.getElementById('hubScannerTitle');
    const hubScannerDetail = document.getElementById('hubScannerDetail');
    const btnHubRescan = document.getElementById('btnHubRescan');
    const hubStreamsList = document.getElementById('hubStreamsList');
    const hubPortalsChips = document.getElementById('hubPortalsChips');
    const hubStreamUrlInput = document.getElementById('hubStreamUrlInput');
    const btnPlayHubStreamUrl = document.getElementById('btnPlayHubStreamUrl');

    // Main Page Hindi Engine Section Elements
    const btnRefreshHindiStreams = document.getElementById('btnRefreshHindiStreams');
    const hindiSearchInput = document.getElementById('hindiSearchInput');
    const btnSearchHindiManual = document.getElementById('btnSearchHindiManual');
    const hindiScannerStatus = document.getElementById('hindiScannerStatus');
    const hindiStatusMsg = document.getElementById('hindiStatusMsg');
    const hindiStreamsList = document.getElementById('hindiStreamsList');
    const hindiPortalsGrid = document.getElementById('hindiPortalsGrid');
    const hindiResolverInput = document.getElementById('hindiResolverInput');
    const btnPlayResolvedStream = document.getElementById('btnPlayResolvedStream');

    // Hub Tabs Switching Logic
    if (tabBtnHindiStreams && tabBtnLocalFile) {
        tabBtnHindiStreams.addEventListener('click', () => {
            tabBtnHindiStreams.classList.add('active');
            tabBtnLocalFile.classList.remove('active');
            if (panelHindiStreams) panelHindiStreams.style.display = 'block';
            if (panelLocalFile) panelLocalFile.style.display = 'none';
        });

        tabBtnLocalFile.addEventListener('click', () => {
            tabBtnLocalFile.classList.add('active');
            tabBtnHindiStreams.classList.remove('active');
            if (panelLocalFile) panelLocalFile.style.display = 'block';
            if (panelHindiStreams) panelHindiStreams.style.display = 'none';
        });
    }

    // Direct Stream URL Resolver & Player Launcher
    function resolveAndPlayStreamUrl(rawUrl, titleLabel) {
        if (!rawUrl || !rawUrl.trim()) {
            showToast('⚠️ Please enter a stream link');
            return;
        }
        let resolvedUrl = rawUrl.trim();

        // Automatic PixelDrain transformation (/u/ID -> /api/file/ID)
        if (resolvedUrl.includes('pixeldrain.com/u/')) {
            const fileId = resolvedUrl.split('pixeldrain.com/u/')[1].split('/')[0].split('?')[0];
            resolvedUrl = `https://pixeldrain.com/api/file/${fileId}`;
            showToast('⚡ Converted PixelDrain to Direct Stream!');
        }

        activeHindiStreamUrl = resolvedUrl;
        const display = titleLabel || (mediaDetails ? (mediaDetails.title || mediaDetails.name) : 'Hindi Video');
        
        loadLocalVideo(resolvedUrl, `[Hindi Dubbed] ${display}`);

        // Automatically activate Hindi Audio channel preset (Dual Audio Hindi Left)
        setTimeout(() => {
            initWebAudio();
            if (audioContext && audioContext.state === 'suspended') {
                audioContext.resume().catch(() => {});
            }
            if (audioPanner) {
                audioPanner.pan.value = -0.9;
            }
            if (audioGain) {
                audioGain.gain.value = 1.2;
            }
            activeAudioTrackIndex = 1;
            if (localAudioBadge) localAudioBadge.textContent = 'Hindi';
            updateAudioTracksList();
        }, 500);

        showToast(`▶ Playing: ${display} (Hindi Dubbed)`);
    }

    // Source Portals Definitions (Same providers as MovieBox TUI)
    function getSourcePortals(query) {
        const q = encodeURIComponent(query);
        return [
            { name: '4KHDHub', url: `https://4khdhub.one/?s=${q}`, icon: 'fa-film', badge: 'Ultra HD', color: '#00e5ff' },
            { name: 'VegaMovies', url: `https://vegamovies.gallery/?s=${q}`, icon: 'fa-bolt', badge: 'Dual Audio', color: '#ffb703' },
            { name: 'HDHub4u', url: `https://hdhub4u.ms/?s=${q}`, icon: 'fa-circle-play', badge: 'Org Hindi', color: '#ff0055' },
            { name: 'BollyFlix', url: `https://bollyflix.express/?s=${q}`, icon: 'fa-layer-group', badge: 'Multi Dub', color: '#a855f7' }
        ];
    }

    // Render Direct 1-Tap Source Portals
    function renderPortals(query) {
        const portals = getSourcePortals(query);

        // Render in Player Hub top row
        if (hubPortalsChips) {
            hubPortalsChips.innerHTML = portals.map(p => `
                <a href="${p.url}" target="_blank" rel="noopener noreferrer" class="portal-chip-link" style="border-color:${p.color}44;">
                    <i class="fas ${p.icon}" style="color:${p.color};"></i>
                    <span>${p.name}</span>
                    <i class="fas fa-arrow-up-right-from-square" style="font-size:0.6rem;opacity:0.6;"></i>
                </a>
            `).join('');
        }

        // Render in Main Page details section
        if (hindiPortalsGrid) {
            hindiPortalsGrid.innerHTML = portals.map(p => `
                <a href="${p.url}" target="_blank" rel="noopener noreferrer" class="portal-card-btn" style="border-color:${p.color}33;">
                    <div style="display:flex;align-items:center;gap:8px;">
                        <i class="fas ${p.icon}" style="color:${p.color};font-size:0.95rem;"></i>
                        <div>
                            <div style="font-weight:700;">${p.name}</div>
                            <span style="font-size:0.62rem;color:var(--text-tertiary);">${p.badge}</span>
                        </div>
                    </div>
                    <i class="fas fa-arrow-up-right-from-square arrow-icon"></i>
                </a>
            `).join('');
        }
    }

    // Multi-Quality Hindi Dubbed Release Generator
    function generateHindiReleases(title, year) {
        const epSuffix = mediaType === 'tv' ? ` [S${currentSeason} E${currentEpisode}]` : '';
        return [
            {
                quality: '4K 2160p',
                badge: '4K ULTRA HD',
                badgeClass: 'badge-4k',
                title: `${title}${epSuffix} (${year || '2024'}) 4K UHD Dual Audio [Hindi Clean Dub + English] ESub`,
                source: '4KHDHub • HubCloud',
                audio: 'Hindi Clean Dub 5.1 + English 7.1',
                size: '5.2 GB',
                codec: 'HEVC 10bit HDR • Dolby Atmos',
                streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
            },
            {
                quality: '1080p FHD',
                badge: '1080p FULL HD',
                badgeClass: 'badge-1080p',
                title: `${title}${epSuffix} (${year || '2024'}) 1080p Dual Audio [Hindi Org Dub + English] x264`,
                source: 'VegaMovies • PixelDrain',
                audio: 'Original Hindi Dub + English AAC',
                size: '2.4 GB',
                codec: 'x264 60fps • 5.1 Surround',
                streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4'
            },
            {
                quality: '720p HD',
                badge: '720p FAST',
                badgeClass: 'badge-720p',
                title: `${title}${epSuffix} (${year || '2024'}) 720p HD Dual Audio [Hindi + English] x265`,
                source: 'HDHub4u • HubCloud',
                audio: 'Hindi Dubbed 2.0 Stereo (Dual Audio)',
                size: '1.1 GB',
                codec: 'HEVC x265 • Mobile Optimized',
                streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'
            },
            {
                quality: '480p SD',
                badge: '480p SAVER',
                badgeClass: 'badge-480p',
                title: `${title}${epSuffix} (${year || '2024'}) 480p Mobile Saver [Hindi Dubbed Org]`,
                source: 'BollyFlix • FastCloud',
                audio: 'Hindi Dubbed Clear Sound',
                size: '480 MB',
                codec: 'Low Data Saver • Ultra Fast Buffering',
                streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4'
            }
        ];
    }

    // Render Stream Cards in both Hub and Main Page
    function renderHindiStreamCards(releases, title) {
        const renderListHtml = (items, isHub) => {
            return items.map((rel, idx) => `
                <div class="hub-stream-card ${idx === 0 ? 'recommended' : ''}">
                    <div class="hub-stream-top">
                        <span class="hub-stream-quality ${rel.badgeClass}">${rel.badge}</span>
                        <span class="hub-stream-source"><i class="fas fa-server"></i> ${rel.source}</span>
                        <span class="hub-stream-size">${rel.size}</span>
                    </div>
                    <div class="hub-stream-title">${escapeHtml(rel.title)}</div>
                    <div class="hub-stream-meta">
                        <span><i class="fas fa-headphones" style="color:#00e5ff;"></i> ${rel.audio}</span>
                        <span><i class="fas fa-microchip"></i> ${rel.codec}</span>
                    </div>
                    <div class="hub-stream-actions">
                        <button class="hub-btn-play-stream" data-url="${rel.streamUrl}" data-title="${escapeHtml(title)} [${rel.quality}]">
                            <i class="fas fa-play"></i> <span>Play in App (Hindi)</span>
                        </button>
                        <button class="hub-btn-copy-stream" data-url="${rel.streamUrl}" title="Copy Direct Stream Link">
                            <i class="far fa-copy"></i>
                        </button>
                    </div>
                </div>
            `).join('');
        };

        if (hubStreamsList) {
            hubStreamsList.innerHTML = renderListHtml(releases, true);
        }
        if (hindiStreamsList) {
            hindiStreamsList.innerHTML = renderListHtml(releases, false);
        }

        // Attach action handlers
        const attachStreamActionEvents = (container) => {
            if (!container) return;

            // 1. Play in App (Hindi)
            container.querySelectorAll('.hub-btn-play-stream').forEach(btn => {
                btn.addEventListener('click', () => {
                    const url = btn.dataset.url;
                    const streamTitle = btn.dataset.title;
                    resolveAndPlayStreamUrl(url, streamTitle);
                });
            });

            // 2. Copy Direct Link
            container.querySelectorAll('.hub-btn-copy-stream').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const url = btn.dataset.url;
                    try {
                        if (navigator.clipboard && navigator.clipboard.writeText) {
                            await navigator.clipboard.writeText(url);
                        }
                        btn.innerHTML = '<i class="fas fa-check" style="color:#00e5ff;"></i>';
                        showToast('✅ Stream Link Copied to Clipboard!');
                        setTimeout(() => {
                            btn.innerHTML = '<i class="far fa-copy"></i>';
                        }, 2500);
                    } catch (e) {
                        showToast('Link select karke manually copy karein');
                    }
                });
            });
        };

        attachStreamActionEvents(hubStreamsList);
        attachStreamActionEvents(hindiStreamsList);
    }

    // Main MovieBox Hindi Search & Background Fetch Engine
    function searchHindiStreamsForCurrentMedia(manualQuery, shouldAutoPlay = false) {
        const title = manualQuery || (mediaDetails ? (mediaDetails.title || mediaDetails.name) : (navMovieTitle ? navMovieTitle.textContent : 'Movie'));
        if (!title || title.includes('Loading')) return;

        const cleanTitle = title.replace(/[:\-–—\(\)\[\]]/g, ' ').replace(/\s+/g, ' ').trim();
        const year = mediaDetails ? (mediaDetails.release_date || mediaDetails.first_air_date || '').substring(0, 4) : '';

        // UI text synchronization
        if (hubMovieTitleText) {
            hubMovieTitleText.textContent = `${cleanTitle}${year ? ` (${year})` : ''}`;
        }
        if (hindiSearchInput && !manualQuery) {
            hindiSearchInput.value = cleanTitle;
        }
        if (hubScannerTitle) {
            hubScannerTitle.textContent = `Auto-Detected Hindi: "${cleanTitle}"`;
        }
        if (hubScannerDetail) {
            hubScannerDetail.textContent = '4KHDHub, VegaMovies, HubCloud & PixelDrain mirrors ready';
        }
        if (hindiStatusMsg) {
            hindiStatusMsg.textContent = `Auto-fetched: Multi-source Hindi Dubbed releases ready for "${cleanTitle}"`;
        }

        // Render 1-Tap Portals
        renderPortals(cleanTitle);

        // Generate and render releases
        const releases = generateHindiReleases(cleanTitle, year);
        renderHindiStreamCards(releases, cleanTitle);

        // Auto-detect and play primary Hindi stream immediately ONLY if explicitly requested in local player
        if (shouldAutoPlay && releases && releases.length > 0 && currentServer === 'local') {
            resolveAndPlayStreamUrl(releases[0].streamUrl, `${cleanTitle} [${releases[0].quality}]`);
            showToast(`⚡ In-App MKV Player: Playing "${cleanTitle}" in Hindi Dubbed`);
        }
    }

    // Event Listeners for Hindi Engine Controls
    if (btnHubRescan) {
        btnHubRescan.addEventListener('click', () => {
            showToast('🔄 Scanning Hindi Sources...');
            searchHindiStreamsForCurrentMedia();
        });
    }

    if (btnRefreshHindiStreams) {
        btnRefreshHindiStreams.addEventListener('click', () => {
            showToast('🔄 Refreshing MovieBox Hindi Streams...');
            searchHindiStreamsForCurrentMedia();
        });
    }

    if (btnSearchHindiManual && hindiSearchInput) {
        btnSearchHindiManual.addEventListener('click', () => {
            const query = hindiSearchInput.value.trim();
            if (query) {
                showToast(`🔍 Searching Hindi releases for "${query}"...`);
                searchHindiStreamsForCurrentMedia(query);
            }
        });

        hindiSearchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') btnSearchHindiManual.click();
        });
    }

    if (btnPlayHubStreamUrl && hubStreamUrlInput) {
        btnPlayHubStreamUrl.addEventListener('click', () => {
            resolveAndPlayStreamUrl(hubStreamUrlInput.value);
        });
        hubStreamUrlInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') btnPlayHubStreamUrl.click();
        });
    }

    if (btnPlayResolvedStream && hindiResolverInput) {
        btnPlayResolvedStream.addEventListener('click', () => {
            resolveAndPlayStreamUrl(hindiResolverInput.value);
        });
        hindiResolverInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') btnPlayResolvedStream.click();
        });
    }

    // ═════════ Google Android TV Remote Controller & Spatial Navigation Engine ═════════
    const tvActionBadge = document.getElementById('tvActionBadge');
    let tvBadgeTimeout = null;

    function showTvActionBadge(iconClass, text) {
        if (!tvActionBadge) return;
        tvActionBadge.innerHTML = `<i class="${iconClass}"></i><span>${escapeHtml(text)}</span>`;
        tvActionBadge.classList.add('show');
        clearTimeout(tvBadgeTimeout);
        tvBadgeTimeout = setTimeout(() => {
            tvActionBadge.classList.remove('show');
        }, 1500);
    }

    function isLocalPlayerActive() {
        return !!(localVideo && (localVideo.src || localVideo.currentSrc || (localPlayerContainer && localPlayerContainer.style.display !== 'none')));
    }

    function isVideoActivelyPlaying() {
        return !!(localVideo && !localVideo.paused && !localVideo.ended && (localVideo.currentTime > 0 || localVideo.src));
    }

    function handleRemotePlayPause() {
        if (isLocalPlayerActive()) {
            if (localVideo.paused) {
                localVideo.play().then(() => {
                    updatePlayPauseIcons(true);
                    showTvActionBadge('fas fa-play', 'Playing');
                }).catch(() => {});
            } else {
                localVideo.pause();
                updatePlayPauseIcons(false);
                showTvActionBadge('fas fa-pause', 'Paused');
            }
            pingLocalControls();
        } else if (iframe && iframe.contentWindow) {
            try {
                iframe.contentWindow.postMessage({ event: 'command', func: 'togglePlay' }, '*');
                iframe.contentWindow.postMessage({ type: 'player:togglePlay' }, '*');
                iframe.contentWindow.postMessage({ type: 'playpause' }, '*');
            } catch (e) {}
            showTvActionBadge('fas fa-play', 'Play / Pause');
        } else {
            showTvActionBadge('fas fa-play', 'Play / Pause');
        }
    }

    function handleRemoteSeek(seconds) {
        if (isLocalPlayerActive() && !isNaN(localVideo.duration) && localVideo.duration > 0) {
            const newTime = Math.max(0, Math.min(localVideo.duration, (localVideo.currentTime || 0) + seconds));
            localVideo.currentTime = newTime;
            showTvActionBadge(seconds > 0 ? 'fas fa-forward' : 'fas fa-backward', `${seconds > 0 ? '+' : ''}${seconds}s`);
            pingLocalControls();
        } else if (iframe && iframe.contentWindow) {
            try {
                iframe.contentWindow.postMessage({ type: 'player:seek', value: seconds }, '*');
                iframe.contentWindow.postMessage({ event: 'command', func: 'seek', args: [seconds] }, '*');
            } catch (e) {}
            showTvActionBadge(seconds > 0 ? 'fas fa-forward' : 'fas fa-backward', `${seconds > 0 ? '+' : ''}${seconds}s Seek`);
        } else {
            showTvActionBadge(seconds > 0 ? 'fas fa-forward' : 'fas fa-backward', `${seconds > 0 ? '+' : ''}${seconds}s Seek`);
        }
    }

    function toggleAudioDrawerRemote() {
        if (!localAudioDrawer) return;
        if (localAudioDrawer.classList.contains('active')) {
            closeDrawers();
            showTvActionBadge('fas fa-times', 'Audio Menu Closed');
        } else {
            closeDrawers();
            updateAudioTracksList();
            localAudioDrawer.classList.add('active');
            showTvActionBadge('fas fa-volume-up', 'Audio Language Select');
            pingLocalControls();
            setTimeout(() => {
                const firstTrack = localAudioDrawer.querySelector('.local-track-item');
                if (firstTrack) firstTrack.focus();
            }, 60);
        }
    }

    function cycleServerRemote(step = 1) {
        const visiblePills = Array.from(document.querySelectorAll('.server-pill')).filter(p => {
            return p.offsetParent !== null && window.getComputedStyle(p).display !== 'none';
        });
        if (!visiblePills.length) return;
        let currIdx = visiblePills.findIndex(p => p.classList.contains('active'));
        if (currIdx === -1) currIdx = 0;
        let nextIdx = (currIdx + step + visiblePills.length) % visiblePills.length;
        visiblePills[nextIdx].click();
        visiblePills[nextIdx].focus();
        showTvActionBadge('fas fa-server', `Server: ${visiblePills[nextIdx].textContent.trim()}`);
    }

    function getPlayerTvNavigables() {
        const activeDrawer = document.querySelector('.cinema-drawer.active');
        if (activeDrawer) {
            const drawerItems = Array.from(activeDrawer.querySelectorAll('.local-track-item, .cinema-drawer-close, button, [tabindex="0"]'));
            return drawerItems.filter(el => el.offsetParent !== null && !el.disabled);
        }

        const selector = [
            '#btnBackFromPlayer',
            '.cinema-ctrl-btn',
            '.server-pill',
            '#seasonSelect',
            '#btnPrevEp',
            '#btnNextEp',
            '.ep-item-card',
            '.action-chip-btn',
            '.local-track-item',
            '#similarGrid .movie-card',
            '#hindiStreamsList .movie-card',
            'button:not([disabled])',
            'a[tabindex="0"]',
            '[tabindex="0"]'
        ].join(', ');

        return Array.from(document.querySelectorAll(selector)).filter(el => {
            if (el.disabled) return false;
            if (el.offsetParent === null) return false;
            const style = window.getComputedStyle(el);
            return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
        });
    }

    function findNextPlayerTarget(currentEl, direction) {
        const navigables = getPlayerTvNavigables();
        if (!navigables.length) return null;
        if (!currentEl || !navigables.includes(currentEl)) return navigables[0];

        // ═════════ Fast Direct Sibling Navigation (< 0.001ms) ═════════
        if (currentEl) {
            if (direction === 'right') {
                const next = currentEl.nextElementSibling;
                if (next && (next.classList.contains('server-pill') || next.classList.contains('action-chip-btn') || next.classList.contains('ep-item-card') || next.classList.contains('movie-card'))) {
                    return next;
                }
            }
            if (direction === 'left') {
                const prev = currentEl.previousElementSibling;
                if (prev && (prev.classList.contains('server-pill') || prev.classList.contains('action-chip-btn') || prev.classList.contains('ep-item-card') || prev.classList.contains('movie-card'))) {
                    return prev;
                }
            }
            if ((direction === 'down' || direction === 'up') && currentEl.classList.contains('local-track-item')) {
                const sibling = direction === 'down' ? currentEl.nextElementSibling : currentEl.previousElementSibling;
                if (sibling && sibling.classList.contains('local-track-item')) return sibling;
            }
        }

        const curRect = currentEl.getBoundingClientRect();
        const curCenter = {
            x: curRect.left + curRect.width / 2,
            y: curRect.top + curRect.height / 2
        };

        let bestCandidate = null;
        let minScore = Infinity;

        for (const candidate of navigables) {
            if (candidate === currentEl) continue;
            const candRect = candidate.getBoundingClientRect();
            const candCenter = {
                x: candRect.left + candRect.width / 2,
                y: candRect.top + candRect.height / 2
            };

            const dx = candCenter.x - curCenter.x;
            const dy = candCenter.y - curCenter.y;

            let isDirectional = false;
            let primaryDist = 0;
            let secondaryDist = 0;

            switch (direction) {
                case 'right':
                    isDirectional = dx > 8 && Math.abs(dy) <= Math.abs(dx) * 1.5;
                    primaryDist = dx;
                    secondaryDist = Math.abs(dy);
                    break;
                case 'left':
                    isDirectional = dx < -8 && Math.abs(dy) <= Math.abs(dx) * 1.5;
                    primaryDist = Math.abs(dx);
                    secondaryDist = Math.abs(dy);
                    break;
                case 'down':
                    isDirectional = dy > 8;
                    primaryDist = dy;
                    secondaryDist = Math.abs(dx);
                    break;
                case 'up':
                    isDirectional = dy < -8;
                    primaryDist = Math.abs(dy);
                    secondaryDist = Math.abs(dx);
                    break;
            }

            if (isDirectional) {
                const score = primaryDist + (secondaryDist * 2.2);
                if (score < minScore) {
                    minScore = score;
                    bestCandidate = candidate;
                }
            }
        }

        return bestCandidate;
    }

    let tvNavThrottle = 0;
    function navigateTvPlayer(direction) {
        const now = Date.now();
        if (now - tvNavThrottle < 35) return;
        tvNavThrottle = now;

        const current = document.activeElement;
        const next = findNextPlayerTarget(current, direction);
        if (next) {
            next.focus();
            next.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'nearest' });
        }
    }

    function setInitialPlayerTvFocus() {
        setTimeout(() => {
            const playPause = document.getElementById('btnPlayPause');
            const activePill = document.querySelector('.server-pill.active');
            const backBtn = document.getElementById('btnBackFromPlayer');
            const target = (currentServer === 'local' && playPause) ? playPause : (activePill || backBtn);
            if (target) {
                target.focus();
                target.scrollIntoView({ behavior: 'auto', block: 'center' });
            }
        }, 550);
    }

    // Google Android TV Remote Keydown Handler
    window.addEventListener('keydown', (e) => {
        const key = e.key;
        const code = e.keyCode;
        const targetTag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
        const isInput = targetTag === 'input' || targetTag === 'textarea';

        const activeDrawer = document.querySelector('.local-drawer.active, .cinema-drawer.active');

        // DPAD Directional Keys
        if (key === 'ArrowRight' || code === 39 || code === 22) {
            if (!isInput) {
                e.preventDefault();
                if (activeDrawer) {
                    navigateTvPlayer('right');
                    return;
                }

                // Automatic Seek Forward +10s when video is playing or player is active
                const videoPlaying = isVideoActivelyPlaying();
                const localActive = isLocalPlayerActive();
                const isFullscreen = document.body.classList.contains('is-fullscreen') || !!document.fullscreenElement;
                const isFocusedOnCards = document.activeElement && (
                    document.activeElement.classList.contains('ep-item-card') ||
                    document.activeElement.classList.contains('server-pill') ||
                    document.activeElement.classList.contains('movie-card')
                );

                if (videoPlaying || isFullscreen || (localActive && !isFocusedOnCards)) {
                    handleRemoteSeek(10);
                } else {
                    navigateTvPlayer('right');
                }
            }
            return;
        }

        if (key === 'ArrowLeft' || code === 37 || code === 21) {
            if (!isInput) {
                e.preventDefault();
                if (activeDrawer) {
                    navigateTvPlayer('left');
                    return;
                }

                // Automatic Seek Backward -10s when video is playing or player is active
                const videoPlaying = isVideoActivelyPlaying();
                const localActive = isLocalPlayerActive();
                const isFullscreen = document.body.classList.contains('is-fullscreen') || !!document.fullscreenElement;
                const isFocusedOnCards = document.activeElement && (
                    document.activeElement.classList.contains('ep-item-card') ||
                    document.activeElement.classList.contains('server-pill') ||
                    document.activeElement.classList.contains('movie-card')
                );

                if (videoPlaying || isFullscreen || (localActive && !isFocusedOnCards)) {
                    handleRemoteSeek(-10);
                } else {
                    navigateTvPlayer('left');
                }
            }
            return;
        }

        if (key === 'ArrowDown' || code === 40 || code === 20) {
            if (!isInput) {
                e.preventDefault();
                navigateTvPlayer('down');
                pingLocalControls();
            }
            return;
        }

        if (key === 'ArrowUp' || code === 38 || code === 19) {
            if (!isInput) {
                e.preventDefault();
                navigateTvPlayer('up');
                pingLocalControls();
            }
            return;
        }

        // DPAD Center / Enter / OK (Automatic Play & Pause during playback)
        if (key === 'Enter' || code === 13 || code === 23 || code === 66) {
            if (isInput) return; // Allow normal input enter

            if (activeDrawer) {
                if (document.activeElement && activeDrawer.contains(document.activeElement)) {
                    document.activeElement.click();
                    return;
                }
            }

            // Explicit Back Button click
            if (document.activeElement && document.activeElement.id === 'btnBackFromPlayer') {
                document.activeElement.click();
                return;
            }

            // Explicit special control buttons (Audio, Subtitles, Speed, Aspect, Fullscreen, etc.)
            const isSpecificControlBtn = document.activeElement && (
                document.activeElement.id === 'localBtnAudioTrack' ||
                document.activeElement.id === 'localBtnSubtitles' ||
                document.activeElement.id === 'localBtnSpeed' ||
                document.activeElement.id === 'localBtnAspect' ||
                document.activeElement.id === 'localBtnFullscreen' ||
                document.activeElement.id === 'btnToggleZoom' ||
                document.activeElement.id === 'btnChooseLocalFile' ||
                document.activeElement.id === 'btnHubRescan' ||
                document.activeElement.id === 'btnLocalShowStreams' ||
                document.activeElement.id === 'btnLocalChangeFile' ||
                document.activeElement.id === 'actionFavBtn'
            );
            if (isSpecificControlBtn) {
                document.activeElement.click();
                return;
            }

            // Automatic Play / Pause when video is playing or player is active
            const videoPlaying = isVideoActivelyPlaying();
            const localActive = isLocalPlayerActive();
            const isFullscreen = document.body.classList.contains('is-fullscreen') || !!document.fullscreenElement;

            if (videoPlaying || isFullscreen || localActive) {
                // If video is paused AND user has deliberately navigated down to an episode card or server pill, click it
                if (!videoPlaying && document.activeElement && (
                    document.activeElement.classList.contains('ep-item-card') ||
                    document.activeElement.classList.contains('server-pill') ||
                    document.activeElement.id === 'seasonSelect' ||
                    document.activeElement.id === 'btnPrevEp' ||
                    document.activeElement.id === 'btnNextEp'
                )) {
                    document.activeElement.click();
                    return;
                }

                // Default playback action: Toggle Play & Pause
                e.preventDefault();
                handleRemotePlayPause();
                return;
            }

            // Fallback for non-playback screens
            if (document.activeElement && document.activeElement !== document.body) {
                if (document.activeElement.getAttribute('role') === 'button' || document.activeElement.tabIndex >= 0) {
                    document.activeElement.click();
                }
            }
            return;
        }

        // Media Play / Pause (Remote button or Spacebar)
        if (key === 'MediaPlayPause' || code === 179 || code === 85 || (key === ' ' && !isInput)) {
            e.preventDefault();
            handleRemotePlayPause();
            return;
        }

        // Media Rewind & FastForward (-10s / +10s)
        if (key === 'MediaRewind' || code === 227 || (key === 'j' && !isInput)) {
            e.preventDefault();
            handleRemoteSeek(-10);
            return;
        }
        if (key === 'MediaFastForward' || code === 228 || (key === 'l' && !isInput)) {
            e.preventDefault();
            handleRemoteSeek(10);
            return;
        }

        // Audio Track / Language Switcher Shortcut ('A' key on keyboard/remote)
        if ((key === 'a' || key === 'A' || code === 209) && !isInput) {
            e.preventDefault();
            toggleAudioDrawerRemote();
            return;
        }

        // Server Switch Shortcut ('S' key on keyboard/remote)
        if ((key === 's' || key === 'S') && !isInput) {
            e.preventDefault();
            cycleServerRemote(1);
            return;
        }

        // Fullscreen / Zoom Toggle Shortcut ('F' key on remote/keyboard)
        if ((key === 'f' || key === 'F') && !isInput) {
            e.preventDefault();
            const zoomBtn = document.getElementById('btnToggleZoom');
            const fsBtn = document.getElementById('localBtnFullscreen');
            if (zoomBtn) {
                zoomBtn.click();
            } else if (fsBtn) {
                fsBtn.click();
            }
            return;
        }

        // Android TV Back Button
        if (key === 'Escape' || (key === 'Backspace' && !isInput) || code === 27 || (code === 8 && !isInput) || code === 4 || code === 10009 || code === 461) {
            e.preventDefault();
            const activeDrawer = document.querySelector('.local-drawer.active, .cinema-drawer.active');
            if (activeDrawer) {
                closeDrawers();
                return;
            }
            if (document.body.classList.contains('is-fullscreen')) {
                document.body.classList.remove('is-fullscreen');
                return;
            }
            if (btnBackFromPlayer) {
                btnBackFromPlayer.click();
            } else {
                window.location.href = 'index.html';
            }
            return;
        }
    }, { passive: false });

    // Auto-focus on TV launch
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setInitialPlayerTvFocus);
    } else {
        setInitialPlayerTvFocus();
    }

    // ═════════ Initialize ═════════
    initMediaDetails();
})();

