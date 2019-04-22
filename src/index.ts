import Octokit from '@octokit/rest'
import consola from 'consola'

import Config from './config'
import GitHubBranchWatcher, { Commit } from './lib/GitHubBranchWatcher'

const octokit = new Octokit({
  auth: `token ${Config.token.github}`
})

async function receiveNewCommit(commit: Commit) {
  const [title] = commit.message.split('\n')

  consola.log(`New commit on upstream: ${title}`)

  const { data: issues } = await octokit.search.issuesAndPullRequests({
    q: `is:issue repo:${Config.origin.owner}/${Config.origin.repo} ${
      commit.commit
    })`
  })
  if (issues.total_count > 0) {
    consola.log(`Already issued for ${title}`)
    return
  }

  const create = {
    owner: Config.origin.owner,
    repo: Config.origin.repo,
    title: `[doc] ${title.replace(/( )?\(#.*\)/, '')}`,
    body: `本家のドキュメントに更新がありました :page_facing_up:\r\nOriginal:${
      commit.link
    }`
  }
  const {
    data: { number }
  } = await octokit.issues.create(create)
  consola.log(`Created issue #${number} for ${title}`)
}

function main() {
  return new Promise((_, rej) => {
    const watcher = new GitHubBranchWatcher({ octokit, interval: 1 * 60 * 1000 })
    watcher.on('error', e => {
      rej(e)
    })
    watcher.on('warning', e => {
      consola.warn(`W: ${e.message}`)
    })
    watcher.on('new-commit', receiveNewCommit)

    const target: {
      target: string
      branch: string
      filterPath?: (p: string) => boolean
    } = {
      target: 'nuxt/docs',
      branch: 'master'
    }
    const startsWith = Config.upstream.startsWith
    if (startsWith) {
      target.filterPath = (p: string) => p.startsWith(startsWith)
    }
    watcher.add(target)
  })
}

main().catch((...e: any[]) => {
  console.error(...e)
  process.exit(1)
})
