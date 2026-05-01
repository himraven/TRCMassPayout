import type { IExporter } from '../../types'

export class ExporterService implements IExporter {
  async exportZip(batchId: string) {
    const payload = JSON.stringify({
      batchId,
      exportedAt: new Date().toISOString(),
      format: 'zip-placeholder',
    })

    return new Blob([payload], { type: 'application/zip' })
  }

  async exportCSV(batchId: string) {
    return ['batchId,status', `${batchId},export-ready`].join('\n')
  }
}

export const exporterService = new ExporterService()