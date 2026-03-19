import { collectFiles, findFile, type FileQuery } from "./collect.js"

type FilesContext = {
  root?: string
}

function createFilesApi(context: FilesContext = {}) {
  return {
    collect(query: FileQuery) {
      return collectFiles(query, context)
    },
    find(query: FileQuery) {
      return findFile(query, context)
    },
    with(options: FilesContext) {
      return createFilesApi({
        root: options.root ?? context.root,
      })
    },
  }
}

export const files = createFilesApi()
