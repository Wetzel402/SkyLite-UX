import prisma from '~/lib/prisma'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    
    const shoppingList = await prisma.shoppingList.create({
      data: {
        name: body.name,
        items: {
          create: body.items || []
        }
      },
      include: {
        items: true,
        _count: {
          select: { items: true }
        }
      }
    })
    
    return shoppingList
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create shopping list'
    })
  }
}) 