import { NextRequest, NextResponse } from 'next/server';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { readFile } from 'fs/promises';
import { join } from 'path';

// 内存存储用于跟踪每个IP的请求次数
// 注意：在生产环境中，应该使用数据库或Redis等持久化存储
const ipRequestCount = new Map<string, { count: number; lastReset: Date }>();

// 获取客户端IP地址的辅助函数
function getClientIP(req: NextRequest): string {
  // 尝试从各种头部获取真实IP
  const forwarded = req.headers.get('x-forwarded-for');
  const realIP = req.headers.get('x-real-ip');
  const clientIP = req.headers.get('x-client-ip');
  const cfConnectingIP = req.headers.get('cf-connecting-ip'); // Cloudflare
  const xOriginalIP = req.headers.get('x-original-ip'); // 一些代理服务器
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  if (realIP) {
    return realIP.trim();
  }
  
  if (clientIP) {
    return clientIP.trim();
  }
  
  if (cfConnectingIP) {
    return cfConnectingIP.trim();
  }
  
  if (xOriginalIP) {
    return xOriginalIP.trim();
  }
  
  // 如果没有找到任何IP头部，返回默认值
  return 'unknown';
}

// 检查IP是否超过每日请求限制
function checkDailyLimit(ip: string): { allowed: boolean; remaining: number } {
  const maxRequestsPerDay = parseInt(process.env.AI_MAX_POST_FREQUENCY_PER_DAY || '3');
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  // 获取或初始化IP的请求记录
  let ipData = ipRequestCount.get(ip);
  
  if (!ipData) {
    ipData = { count: 0, lastReset: today };
    ipRequestCount.set(ip, ipData);
  }
  
  // 检查是否需要重置计数器（新的一天）
  if (ipData.lastReset < today) {
    ipData.count = 0;
    ipData.lastReset = today;
  }
  
  // 检查是否超过限制
  if (ipData.count >= maxRequestsPerDay) {
    return { allowed: false, remaining: 0 };
  }
  
  // 增加计数
  ipData.count++;
  
  return { allowed: true, remaining: maxRequestsPerDay - ipData.count };
}

// 从本地化文件中读取系统提示词的辅助函数
async function getSystemPromptFromLocale(locale: string): Promise<string> {
  try {
    // 默认使用英文
    let localePath = '/public/locales/en/chat.json';
    
    // 如果指定了有效的语言，使用对应的语言文件
    if (locale === 'zh') {
      localePath = '/public/locales/zh/chat.json';
    }
    
    // 读取文件内容
    const filePath = join(process.cwd(), localePath);
    const fileContent = await readFile(filePath, 'utf8');
    const chatData = JSON.parse(fileContent);
    
    // 确保返回的是字符串
    const systemPrompt = chatData.systemPrompt || "You are a helpful assistant.";
    return typeof systemPrompt === 'string' ? systemPrompt : "You are a helpful assistant.";
  } catch (error) {
    console.error('Error reading system prompt from locale file:', error);
    return "You are a helpful assistant.";
  }
}

// AI chat handler with Vercel AI SDK integration
export async function POST(req: NextRequest) {
  try {
    // 获取客户端IP并检查频率限制
    const clientIP = getClientIP(req);
    const limitCheck = checkDailyLimit(clientIP);
    
    // 如果超过每日限制，返回正常响应但包含错误信息
    if (!limitCheck.allowed) {
      return NextResponse.json(
        { 
          response: 'You have exceeded the maximum daily message sending limit. Please study other projects or come back tomorrow to request AI.',
          intent: 'error',
          errorType: 'RATE_LIMIT_EXCEEDED',
          remainingRequests: 0,
          metadata: {
            model: 'rate-limited',
            timestamp: new Date().toISOString(),
            tokenCount: {
              input: 0,
              output: 0
            }
          }
        }, 
        { status: 200 }
      );
    }

    const body = await req.json();
    const { message, history, model, apiKey, endpoint, locale = 'en' } = body;

    // Validate required fields
    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // 从本地化文件中读取系统提示词
    const systemPrompt = await getSystemPromptFromLocale(locale);

    // Use provided API key or fallback to environment variable
    // Note: We allow empty API key from frontend and use environment variable instead
    const apiKeyToUse = (apiKey && apiKey.trim() !== '') ? apiKey : process.env.AI_API_KEY;
    if (!apiKeyToUse) {
      return NextResponse.json({ error: 'API key is required' }, { status: 400 });
    }

    // Get API base URL from environment or use the provided endpoint
    // Note: DeepSeek API uses /chat/completions endpoint, not /responses
    const apiBaseUrl = process.env.AI_API_BASE_URL || endpoint || 'https://api.openai.com/v1';

    const apiModel = model || process.env.AI_API_MODEL || 'gpt-4';
    
    // Create a custom OpenAI provider with the specified API base URL
    const customOpenAI = createOpenAI({
      apiKey: apiKeyToUse,
      baseURL: apiBaseUrl,
    });

    // Prepare chat history - filter out the welcome message and convert to proper format
    const chatHistory = history 
      ? history
          .filter((h: any) => h.id !== 'welcome') // Filter out welcome message
          .map((h: any) => ({
            role: h.role === 'bot' ? 'assistant' : h.role,
            content: h.content
          }))
      : [];

    // Create messages array with system prompt
    const messages = [
      { role: 'system', content: systemPrompt },
      ...chatHistory,
      { role: 'user', content: message }
    ];

    // Use direct API call instead of AI SDK to avoid role issues
    try {
      const response = await fetch(`${apiBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKeyToUse}`
        },
        body: JSON.stringify({
          model: apiModel,
          messages: messages,
          temperature: 0.7,
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('API Error:', errorData);
        throw new Error(errorData.error?.message || 'API request failed');
      }

      const data = await response.json();
      const text = data.choices[0].message.content;
      
      const intent = message.toLowerCase().includes('mint') ? 'mint' : 'chat';

      const responseData = {
        response: text,
        intent,
        remainingRequests: limitCheck.remaining,
        metadata: {
          model: apiModel,
          timestamp: new Date().toISOString(),
          tokenCount: {
            input: data.usage?.prompt_tokens || 0,
            output: data.usage?.completion_tokens || 0
          }
        }
      };

      return NextResponse.json(responseData);
    } catch (apiError) {
      console.error('Direct API Error:', apiError);
      // Try with a simpler message format
      const simpleMessages = [
        { role: 'user', content: message }
      ];
      
      const response = await fetch(`${apiBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKeyToUse}`
        },
        body: JSON.stringify({
          model: apiModel,
          messages: simpleMessages,
          temperature: 0.7,
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Simple API Error:', errorData);
        throw new Error(errorData.error?.message || 'API request failed');
      }

      const data = await response.json();
      const text = data.choices[0].message.content;
      
      const intent = message.toLowerCase().includes('mint') ? 'mint' : 'chat';

      const responseData = {
        response: text,
        intent,
        remainingRequests: limitCheck.remaining,
        metadata: {
          model: apiModel,
          timestamp: new Date().toISOString(),
          tokenCount: {
            input: data.usage?.prompt_tokens || 0,
            output: data.usage?.completion_tokens || 0
          }
        }
      };

      return NextResponse.json(responseData);
    }
  } catch (error) {
    console.error('Error handling chat request:', error);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// Test endpoint
export async function GET() {
  return NextResponse.json({ message: 'API is working' });
}