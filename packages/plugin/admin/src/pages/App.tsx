import { Routes, Route } from 'react-router-dom';
import { Page } from '@strapi/strapi/admin';
import { FieldRegistryProvider } from '../contexts/FieldRegistryContext';
import { FormsList } from './FormsList';
import { NewForm } from './NewForm';
import { FormBuilder } from './FormBuilder';
import { SubmissionsInbox } from './SubmissionsInbox';
import { NotificationsPage } from './NotificationsPage';
import { WebhooksPage } from './WebhooksPage';
import { AnalyticsPage } from './AnalyticsPage';
export const App = () => {
  return (
    <FieldRegistryProvider>
      <Routes>
        <Route index element={<FormsList />} />
        <Route path="forms" element={<FormsList />} />
        <Route path="forms/new" element={<NewForm />} />
        <Route path="forms/edit/:documentId" element={<FormBuilder />} />
        <Route path="forms/edit/:documentId/notifications" element={<NotificationsPage />} />
        <Route path="forms/edit/:documentId/webhooks" element={<WebhooksPage />} />
        <Route path="forms/edit/:documentId/analytics" element={<AnalyticsPage />} />
        <Route path="submissions/:formDocumentId" element={<SubmissionsInbox />} />
        <Route path="*" element={<Page.Error />} />
      </Routes>
    </FieldRegistryProvider>
  );
};
