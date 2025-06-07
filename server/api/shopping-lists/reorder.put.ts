import prisma from '~/lib/prisma'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { listIds } = body
    
    // Update the order for each list
    const updatePromises = listIds.map((id: string, index: number) => 
      prisma.shoppingList.update({
        where: { id },
        data: { order: index }
      })
    )
    
    await Promise.all(updatePromises)
    
    return { success: true }
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to reorder shopping lists'
    })
  }
}) 