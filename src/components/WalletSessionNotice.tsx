"use client";

import { useAuth } from '@/contexts/AuthContext';

function short(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export default function WalletSessionNotice() {
  const { address, walletAddress, walletAvailable, walletMismatch, loading } = useAuth();
  if (loading || !address) return null;

  if (!walletAvailable) {
    return <div className="wallet-session-notice warning">Phiên đăng nhập vẫn còn hiệu lực, nhưng trình duyệt không tìm thấy ví. Thao tác ký sẽ cần MetaMask.</div>;
  }
  if (!walletAddress) {
    return <div className="wallet-session-notice warning">Ví đang khoá hoặc chưa cấp quyền cho trang này. Mở ví trước khi gửi hoặc phê duyệt tài liệu.</div>;
  }
  if (walletMismatch) {
    return <div className="wallet-session-notice danger">Phiên đang dùng {short(address)}, nhưng MetaMask đang chọn {short(walletAddress)}. Hãy kết nối lại trước khi tiếp tục.</div>;
  }
  return null;
}
