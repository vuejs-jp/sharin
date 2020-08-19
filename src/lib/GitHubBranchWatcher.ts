import Octokit from '@octokit/rest'
import EventEmitter from 'events'

export type Commit = {
  repo: string
  owner: string
  link: string
  message: string
  commit: string
  filenames: Array<string>
}

type Target = {
  owner: string
  repo: string
  branch: string
  seenCommitKey: symbol
  filterPath?: (path: string) => boolean
}

export default class extends EventEmitter {
  on(event: 'error', handler: (e: Error) => void): this
  on(event: 'warning', handler: (e: Error) => void): this
  on(event: 'new-commit', handler: (c: Commit) => void): this
  on(event: 'end', handler: () => void): this

  on(event: string | symbol, listener: (...args: any[]) => void) {
    return super.on(event, listener)
  }

  emit(event: 'error', e: Error): boolean
  emit(event: 'warning', e: Error): boolean
  emit(event: 'new-commit', c: Commit): boolean
  emit(event: 'end'): boolean

  emit(event: string | symbol, ...args: any[]) {
    return super.emit(event, ...args)
  }

  private octokit: Octokit
  private targets: Target[]
  private seenCommits: Map<Symbol, { [gitRef: string]: true }>

  constructor({ octokit, interval }: { octokit: Octokit; interval: number }) {
    super()

    this.octokit = octokit
    this.targets = []
    this.seenCommits = new Map()

    const id = setInterval(async () => {
      try {
        this.runner()
      } catch (e) {
        this.emit('error', e)
        clearInterval(id)
      }
    }, interval)
  }

  add({
    target,
    branch,
    filterPath
  }: {
    target: string
    branch: string
    filterPath?: (path: string) => boolean
  }) {
    if (target.split('/').length === 2) {
      const [owner, repo] = target.split('/')
      this.targets.push({
        owner,
        repo,
        branch,
        filterPath,
        seenCommitKey: Symbol()
      })
      this.runner()
      return true
    }
    return false
  }

  private async runner() {
    const main = async (target: Target) => {
      const seenCommit = this.seenCommits.get(target.seenCommitKey) || {}
      let filenames: string[]

      const { repo, owner, filterPath } = target

      const u = await this.octokit.repos.listCommits({
        repo,
        owner,
        sha: target.branch,
        per_page: 20
      })

      const { data } = u as { data: any[] }

      const df = async (d: any) => {
        const {
          sha,
          html_url,
          commit: { message }
        } = d
        if (d.sha in seenCommit) {
          return
        }

        if (filterPath) {
          const {
            data: { files }
          } = await this.octokit.repos.getCommit({
            repo,
            owner,
            sha
          })
          filenames = files
            .filter(({ filename }) => {
              return filterPath(filename)
            })
            .map(({ filename }) => {
              return filename
            })
          if (filenames.length === 0) {
            // ignored
            seenCommit[sha] = true
            return
          }
        }

        if (
          this.emit('new-commit', {
            repo,
            owner,
            commit: d.sha,
            link: html_url,
            message,
            filenames
          })
        ) {
          seenCommit[sha] = true
        }
      }
      await Promise.all(
        data.map(async d => {
          try {
            await df(d)
          } catch (e) {
            this.emit('warning', e)
          }
        })
      )

      this.seenCommits.set(target.seenCommitKey, seenCommit)
    }

    await Promise.all(
      this.targets.map(async target => {
        try {
          await main(target)
        } catch (e) {
          this.emit('warning', e)
        }
      })
    )

    this.emit('end')
  }
}
