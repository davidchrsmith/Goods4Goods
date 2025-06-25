import Config from 'react-native-config'

const OPENAI_API_KEY = Config.OPENAI_API_KEY
const AI_ENDPOINT = Config.AI_VALUATION_ENDPOINT

export const getAIValuation = async (title, description, condition, imageUrls) => {
  try {
    const prompt = `
You are an expert appraiser. Based on the following item details, provide a fair market value estimate in USD.

Item: ${title}
Description: ${description}
Condition: ${condition}
${imageUrls.length > 0 ? `Images: ${imageUrls.join(', ')}` : 'No images provided'}

Please respond with only a number representing the estimated dollar value (e.g., 25.50 for $25.50).
Consider factors like:
- Item condition and age
- Market demand
- Replacement cost
- Depreciation

Be realistic and conservative in your estimate.
    `

    const response = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 50,
        temperature: 0.3
      })
    })

    if (!response.ok) {
      throw new Error(`AI API error: ${response.status}`)
    }

    const result = await response.json()
    const valueText = result.choices[0]?.message?.content?.trim()
    const value = parseFloat(valueText)
    
    return isNaN(value) ? 0 : Math.max(0, Math.min(value, 10000)) // Cap at $10k
  } catch (error) {
    console.error('AI Valuation error:', error)
    // Fallback valuation based on keywords
    return getFallbackValuation(title, description, condition)
  }
}

const getFallbackValuation = (title, description, condition) => {
  // Simple keyword-based fallback valuation
  const text = `${title} ${description}`.toLowerCase()
  let baseValue = 10 // Default $10
  
  // Electronics
  if (text.includes('iphone') || text.includes('samsung')) baseValue = 200
  else if (text.includes('laptop') || text.includes('computer')) baseValue = 300
  else if (text.includes('tv') || text.includes('television')) baseValue = 150
  else if (text.includes('camera')) baseValue = 100
  else if (text.includes('headphones') || text.includes('earbuds')) baseValue = 50
  
  // Furniture
  else if (text.includes('couch') || text.includes('sofa')) baseValue = 200
  else if (text.includes('table') || text.includes('desk')) baseValue = 100
  else if (text.includes('chair')) baseValue = 50
  
  // Clothing
  else if (text.includes('jacket') || text.includes('coat')) baseValue = 30
  else if (text.includes('shoes') || text.includes('sneakers')) baseValue = 40
  else if (text.includes('dress') || text.includes('shirt')) baseValue = 15
  
  // Books/Media
  else if (text.includes('book')) baseValue = 5
  else if (text.includes('game') || text.includes('xbox') || text.includes('playstation')) baseValue = 30
  
  // Apply condition multiplier
  const conditionMultipliers = {
    'new': 1.0,
    'like_new': 0.8,
    'good': 0.6,
    'fair': 0.4,
    'poor': 0.2
  }
  
  return Math.round(baseValue * (conditionMultipliers[condition] || 0.6))
}