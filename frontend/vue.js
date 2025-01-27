let settingsVersion = 1.1

const settingsList = []

let STATUS = {
  AUTH_FAILED: -2,
  AUTHENTICATING: -1,
  LOADING: 0,
  READY: 1,
}

var app = Vue.createApp({
  data: () => {
    return {
      page: 0,
      postings: [],
      password: "",
      passwordVisible: false,
      panel: 'home',
      status: STATUS.AUTHENTICATING,
      settings: JSON.parse(localStorage.getItem("settings")),
      shortlist: JSON.parse(localStorage.getItem("shortlist")) ?? [],
      blacklist: JSON.parse(localStorage.getItem("blacklist")) ?? [],
      search: new URLSearchParams(window.location.search).has('s') ? new URLSearchParams(window.location.search).get('s') : "",
      themeAndDegreesOpen: false,
      themeOpen: false,
      degreeOpen: false,
      themesAndDegrees: {
        "themes": [],
        "degrees": [],
      },
      STATUS: STATUS,
    }
  },
  computed: {
    filteredPostings: function () {
      return app.search == "" ? getCleaned(app.postings) : getSearch(app.postings, app.search);
    },
    Exported: function () {
      let shortliststr = ""
      let blackliststr = ""
      // app.shortlist.forEach(x => shortliststr += `\t\"${x}\",\n`)
      // app.blacklist.forEach(x => blackliststr += `\t\"${x}\",\n`)
      shortliststr = app.shortlist.join(", ")
      blackliststr = app.blacklist.join(", ")
      return `SHORTLIST: ${shortliststr}\n\nBLACKLIST: ${blackliststr}`
    }
  },
  methods: {
    makeVisible: (id, type) => {
      document.getElementById(`${type}-readmore-${id}`).classList.remove("truncate")
      document.getElementById(`${type}-readmore-${id}`).classList.remove("max-h-48")
      document.getElementById(`${type}-readmorebtn-${id}`).classList.add("hidden")
    },
    getHeight: (id, type) => {
      return document.getElementById(`${type}-readmore-${id}`).offsetHeight
    },
    UpdateURLSearch: () => {
      let queryParams = new URLSearchParams(window.location.search);
      queryParams.set("s", app.search);
      history.replaceState(null, null, "?" + queryParams.toString())
    },
    submitPassword: () => {
      app.status = STATUS.LOADING
      fetchJSON(app.password)
    },
    saveSettings: () => {
      localStorage.setItem("settings", JSON.stringify(app.settings))
    },
    resetSettings: () => {
      app.settings = {
        version: settingsVersion,
        themes: {},
        degrees: {},
        NoExternal: true,
        NoCoverLetters: true,
        FourMonthOnly: true,
        FourMonthOnly: false,
        NoSenior: false,
        RemoteOnly: false,
        InPersonOnly: false,
        ShortlistOnly: false,
        NoShortlist: false,
        BlacklistOnly: false,
        NoBlacklist: true,
        ApplyToSearch: false,
      };
      app.saveSettings();
    },
    saveLists: () => {
      localStorage.setItem('shortlist', JSON.stringify(app.shortlist))
      localStorage.setItem('blacklist', JSON.stringify(app.blacklist))
    },
    copyText: (text) => {
      navigator.clipboard.writeText(text)
    },
    showMessage: (message) => {
      let el = document.getElementById('messageToast')
      el.innerHTML = message
      el.classList.remove('fade-in-out')
      window.requestAnimationFrame(() => { el.classList.add('fade-in-out') })
    }
  },
  components: {
    jobposting: {
      props: ['job', 'shortlist', 'blacklist'],
      template: '#jobPostingTemplate',
      methods: {
        saveLists: () => {
          localStorage.setItem('shortlist', JSON.stringify(app.shortlist))
          localStorage.setItem('blacklist', JSON.stringify(app.blacklist))
        },
      }
    },
    setting: {
      props: ['modelValue', 'desc', 'title'],
      emits: ['update:modelValue', 'change'],
      template: '#settingTemplate',
      computed: {
        value: {
          get() {
            return this.modelValue
          },
          set(value) {
            this.$emit('update:modelValue', value)
          }
        }
      }
    }
  }
}).mount('#app')

// Comment out the next line to use local data
// ENDPOINT = new URL(`http://${location.host.split(":")[0]}:3000/`)
SKIP_AUTH = true

if (typeof ENDPOINT === 'undefined' || SKIP_AUTH) {
  fetchJSON('')
}

if (!(app.settings?.version == settingsVersion)) {
  app.resetSettings()
}

localStorage.setItem("settings", JSON.stringify(app.settings))

// Returns postings that match the set filters
function getCleaned(postings) {
  // Apply filters
  [
    [app.settings.NoExternal,
    x => !x.special.includes("External")],

    [app.settings.NoCoverLetters,
    x => !x.documents.includes("Cover Letter")],

    [app.settings.FourMonthOnly,
    x => x.duration.includes("4-month")],

    [app.settings.NoSenior,
    x => !x.level[0].includes("Senior")],

    [app.settings.NoSWPP,
    x => !x.special.includes("SWPP")],

    [app.settings.InPersonOnly,
    x => !x.remote.includes("Remote")],

    [app.settings.RemoteOnly,
    x => !x.remote.includes("In-person")],

    [app.settings.ShortlistOnly,
    x => app.shortlist.includes(x.id)],

    [app.settings.NoShortlist,
    x => !app.shortlist.includes(x.id)],

    [app.settings.BlacklistOnly,
    x => app.blacklist.includes(x.id)],

    [app.settings.NoBlacklist,
    x => !app.blacklist.includes(x.id)],

    [Object.values(app.settings.themes).some(x => x) || Object.values(app.settings.degrees).some(x => x),
    x => x.themes.themes.some(theme => app.settings.themes[theme]) || x.themes.degrees.some(degree => app.settings.degrees[degree])]

  ].forEach((x) => { x[0] && (() => { postings = postings.filter(x[1]) })() });

  return postings.sort((a, b) => {
    const A = a.company.toUpperCase(); // ignore upper and lowercase
    const B = b.company.toUpperCase(); // ignore upper and lowercase
    if (A < B) {
      return -1;
    }
    if (A > B) {
      return 1;
    }

    // names must be equal
    return 0;
  })
}

// Get postings that match search results
function getSearch(postings, search) {
  let invertSearch = false
  if (search.startsWith("!")) {
    invertSearch = true
    search = search.slice(1)
  }
  if (!search.match(/^\/.*\/$/)) {
    query = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "gi")
  } else {
    try {
      query = new RegExp(search.slice(1, -1))
    } catch {
      query = new RegExp("$^")
    }
  }
  if (!invertSearch) {
    return (app.settings.ApplyToSearch ? getCleaned(postings) : postings).filter(x => query.test(x.id) || query.test(x.title) || query.test(x.company) || query.test(x.location) || query.test(x.summary) || query.test(x.responsibilities) || query.test(x.skills) || query.test(x.compensation))
  } else {
    return (app.settings.ApplyToSearch ? getCleaned(postings) : postings).filter(x => !(query.test(x.id) || query.test(x.title) || query.test(x.company) || query.test(x.location) || query.test(x.summary) || query.test(x.responsibilities) || query.test(x.skills) || query.test(x.compensation)))
  }
}
