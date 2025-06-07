import prisma from '~/lib/prisma'

export default defineEventHandler(async (event) => {
  try {
    const integrationId = getRouterParam(event, 'id')
    const body = await readBody(event)
    
    if (!integrationId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Integration ID is required'
      })
    }
    
    const integration = await prisma.integration.update({
      where: { id: integrationId },
      data: {
        name: body.name,
        type: body.type,
        apiKey: body.apiKey,
        baseUrl: body.baseUrl,
        enabled: body.enabled,
        settings: body.settings
      }
    })
    
    return integration
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to update integration'
    })
  }
}) 