import OpenAI from 'openai';

async function test() {
  console.log('Testing NVIDIA API...');
  const openai = new OpenAI({
    apiKey: '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',
    baseURL: 'https://integrate.api.nvidia.com/v1',
  });

  try {
    const response = await openai.chat.completions.create({
      model: 'moonshotai/kimi-k2.5',
      messages: [{ role: 'user', content: 'Say hello' }],
      max_tokens: 50,
    });
    console.log('Success:', response.choices[0].message.content);
  } catch (error) {
    console.error('Error:', error.message);
  }
}
test();
