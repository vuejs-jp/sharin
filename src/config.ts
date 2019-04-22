type Config = {
  upstream: {
    owner: string
    repo: string
    branch: string
    startsWith?: string
  }
  origin: {
    owner: string
    repo: string
  }
  token: {
    github: string
  }
}

const config: Config = {
  upstream: {
    owner: process.env.SHARIN_UPSTREAM_REPO!.split('/').shift()!,
    repo: process.env.SHARIN_UPSTREAM_REPO!.split('/').pop()!,
    branch: process.env.SHARIN_UPSTREAM_BRANCH!,
    startsWith: process.env.SHARIN_UPSTREAM_CHANGED_FILEPATH_STARTS_WITH
  },
  origin: {
    owner: process.env.SHARIN_ORIGIN_REPO!.split('/').shift()!,
    repo: process.env.SHARIN_ORIGIN_REPO!.split('/').pop()!
  },
  token: {
    github: process.env.SHARIN_TOKEN_GITHUB!
  }
}

export default config
