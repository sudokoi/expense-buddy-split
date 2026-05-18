import { Generator, getConfig } from '@tanstack/router-generator'

const root = process.cwd()
const config = getConfig(undefined, root)
const generator = new Generator({ config, root })

await generator.run()
