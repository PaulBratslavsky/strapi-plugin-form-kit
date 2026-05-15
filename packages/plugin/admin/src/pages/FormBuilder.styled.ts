/**
 * Styled-components for FormBuilder.tsx. Extracted so the page component
 * is logic + JSX only — the ~150 lines of CSS-in-JS were burying it.
 */
import styled from 'styled-components';

export const PageBg = styled.div`
  background: ${({ theme }) => theme?.colors?.neutral100 ?? '#f6f6f9'};
  min-height: 100%;
  padding-bottom: 96px;
`;

export const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 32px;
  background: ${({ theme }) => theme?.colors?.neutral0 ?? '#fff'};
  border-bottom: 1px solid ${({ theme }) => theme?.colors?.neutral200 ?? '#dcdce4'};
`;

export const HeaderActions = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
`;

export const Layout = styled.div<{ $hasDrawer: boolean }>`
  display: grid;
  grid-template-columns: 340px 1fr ${({ $hasDrawer }) => ($hasDrawer ? '380px' : '0px')};
  gap: 24px;
  padding: 24px 32px;
  align-items: start;
  transition: grid-template-columns 200ms ease;
`;

export const PaletteCard = styled.div`
  background: ${({ theme }) => theme?.colors?.neutral0 ?? '#fff'};
  border: 1px solid ${({ theme }) => theme?.colors?.neutral200 ?? '#dcdce4'};
  border-radius: 12px;
  position: sticky;
  top: 24px;
  max-height: calc(100vh - 64px);
  overflow-y: auto;
`;

export const ConfigDrawer = styled.div<{ $open: boolean }>`
  background: ${({ theme }) => theme?.colors?.neutral0 ?? '#fff'};
  border: 1px solid ${({ theme }) => theme?.colors?.neutral200 ?? '#dcdce4'};
  border-radius: 12px;
  position: sticky;
  top: 24px;
  max-height: calc(100vh - 120px);
  overflow-y: auto;
  opacity: ${({ $open }) => ($open ? 1 : 0)};
  pointer-events: ${({ $open }) => ($open ? 'auto' : 'none')};
  transition: opacity 200ms ease;
`;

export const DrawerHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  border-bottom: 1px solid ${({ theme }) => theme?.colors?.neutral200 ?? '#dcdce4'};
`;

export const SaveBar = styled.div`
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 16px 32px;
  background: ${({ theme }) => theme?.colors?.neutral0 ?? '#fff'};
  border-top: 1px solid ${({ theme }) => theme?.colors?.neutral200 ?? '#dcdce4'};
  box-shadow: 0 -2px 6px rgba(33, 33, 52, 0.04);
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 5;
`;

export const AiDrawer = styled.aside<{ $open: boolean }>`
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: min(420px, 92vw);
  background: ${({ theme }) => theme?.colors?.neutral0 ?? '#fff'};
  border-left: 1px solid ${({ theme }) => theme?.colors?.neutral200 ?? '#dcdce4'};
  box-shadow: -4px 0 16px rgba(33, 33, 52, 0.06);
  transform: translateX(${({ $open }) => ($open ? '0' : '100%')});
  transition: transform 220ms ease;
  z-index: 51;
  display: flex;
  flex-direction: column;
`;

export const AiDrawerCloseBar = styled.div`
  display: flex;
  justify-content: flex-end;
  padding: 8px;
  border-bottom: 1px solid ${({ theme }) => theme?.colors?.neutral200 ?? '#dcdce4'};
`;

export const ErrorBanner = styled.div`
  margin: 0 32px 16px 32px;
  padding: 12px 16px;
  background: ${({ theme }) => theme?.colors?.danger100 ?? '#fcecea'};
  border: 1px solid ${({ theme }) => theme?.colors?.danger200 ?? '#f5c0b8'};
  border-radius: 8px;
  color: ${({ theme }) => theme?.colors?.danger600 ?? '#d02b20'};
`;

export const StatusDot = styled.span<{ $color: string }>`
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: ${({ $color }) => $color};
`;

export const PublishedDot = styled(StatusDot).attrs({ $color: '#18794e' })`
  box-shadow: 0 0 0 3px rgba(24, 121, 78, 0.15);
`;

export const DraftDot = styled(StatusDot).attrs({ $color: '#a78a07' })`
  box-shadow: 0 0 0 3px rgba(167, 138, 7, 0.15);
`;

export const ModeSwitcher = styled.div`
  display: inline-flex;
  padding: 3px;
  background: ${({ theme }) => theme?.colors?.neutral100 ?? '#f6f6f9'};
  border: 1px solid ${({ theme }) => theme?.colors?.neutral200 ?? '#dcdce4'};
  border-radius: 999px;
`;

export const ModeButton = styled.button<{ $active: boolean }>`
  border: none;
  padding: 6px 18px;
  cursor: pointer;
  font-size: 0.8125rem;
  font-weight: 600;
  border-radius: 999px;
  background: ${({ $active, theme }) =>
    $active ? theme?.colors?.neutral0 ?? '#fff' : 'transparent'};
  color: ${({ $active, theme }) =>
    $active ? theme?.colors?.primary600 ?? '#4945ff' : theme?.colors?.neutral700 ?? '#4a4a6a'};
  box-shadow: ${({ $active }) => ($active ? '0 1px 3px rgba(33, 33, 52, 0.08)' : 'none')};
  transition: background 120ms ease, color 120ms ease;
`;
