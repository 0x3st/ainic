// /api/payment/return - Payment return handler (synchronous user redirect)
// 用于处理 LinuxDO Credit 支付完成后的用户跳转

import type { Env } from '../../lib/types';

// GET /api/payment/return - Handle user return from LinuxDO Credit payment page
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request } = context;
  const url = new URL(request.url);

  // 根据文档，LinuxDO Credit 不会在 return_url 传递参数
  // return_url 仅用于支付完成后将用户重定向回商户网站
  // 实际的支付结果通过 notify_url 异步通知获取

  console.log('[Payment Return] User returned from payment, redirecting to homepage');

  // 重定向到首页，前端会自动刷新获取最新状态
  const homeUrl = new URL('/', url.origin);
  homeUrl.searchParams.set('from', 'payment');

  return Response.redirect(homeUrl.toString(), 302);
};
