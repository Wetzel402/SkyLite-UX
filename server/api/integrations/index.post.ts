import prisma from '~/lib/prisma'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    
    const integration = await prisma.integration.create({
      data: {
        name: body.name,
        type: body.type,
        apiKey: body.apiKey,
        baseUrl: body.baseUrl,
        enabled: body.enabled ?? true,
        settings: body.settings,
        service: body.service
      }
    })
    
    return integration
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create integration'
    })
  }
}) 