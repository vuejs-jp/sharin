import Octokit from '@octokit/rest'
import consola from 'consola'

import Config from './config'
import GitHubBranchWatcher, { Commit } from './lib/GitHubBranchWatcher'

const octokit = new Octokit({
  auth: `token ${Config.token.github}`
})

const Category = {
  Api: 'api',
  Blog: 'blog',
  Faq: 'faq',
  Guide: 'guide',
  Guides: 'guides'
} as const

type Category = typeof Category[keyof typeof Category]

function getLabels(filenames: Array<string>): Array<string> {
  const prefix = Config.upstream.startsWith
  const labels = new Set<string>(['help wanted'])

  for (var filename of filenames) {
    for (const category of Object.values(Category)) {
      if (filename.startsWith(prefix + category + '/')) {
        labels.add(category)
      }
    }
  }
  return Array.from(labels)
}

async function receiveNewCommit(commit: Commit) {
  const [title] = commit.message.split('\n')

  consola.log(`New commit on upstream: ${title}`)

  const { data: issues } = await octokit.search.issuesAndPullRequests({
    q: `is:issue repo:${Config.origin.owner}/${Config.origin.repo} ${
      commit.commit
    })`
  })

  if (issues.total_count > 0) {
    consola.info(`Already issued for ${title}`)
    return
  }

  const create = {
    owner: Config.origin.owner,
    repo: Config.origin.repo,
    title: `[doc] ${title.replace(/( )?\(#.*\)/, '')}`,
    labels: getLabels(commit.filenames),
    body: `本家のドキュメントに更新がありました :page_facing_up:\r\nOriginal: ${
      commit.link
    }\r\nFiles:\r\n ${commit.filenames.join('\r\n')}`
  }
  try {
    const {
      data: { number }
    } = await octokit.issues.create(create)
    consola.success(`Created issue #${number} for ${title}`)
  } catch (e) {
    consola.error(`Create issue failed(${title})`)
  }
}

function main() {
  return new Promise((_, rej) => {
    const watcher = new GitHubBranchWatcher({
      octokit,
      interval: 1 * 60 * 1000
    })
    watcher.on('error', e => {
      rej(e)
    })
    watcher.on('warning', e => {
      consola.warn(`W: ${e.message}`)
    })
    watcher.on('new-commit', receiveNewCommit)
    watcher.on('end', () => {
      setTimeout(() => {
        process.exit(0)
      }, 5 * 1000)
    })

    const target: {
      target: string
      branch: string
      filterPath?: (p: string) => boolean
    } = {
      target: 'nuxt/nuxtjs.org',
      branch: 'master'
    }
    const startsWith = Config.upstream.startsWith
    if (startsWith) {
      target.filterPath = (p: string) => p.startsWith(startsWith)
    }
    watcher.add(target)
  })
}

async function run() {
  try {
    await main()
    process.exit(0)
  } catch (e) {
    console.error(...e)
    process.exit(1)
  }
}

run()
