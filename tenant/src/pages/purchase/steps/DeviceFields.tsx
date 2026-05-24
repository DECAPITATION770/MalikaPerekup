import { useTranslation } from 'react-i18next';
import { Controller, type Control, type UseFormRegister, type FieldErrors } from 'react-hook-form';

import Input from '@/components/ui/labeled-input';
import DocumentUploader from '@/components/DocumentUploader';
import { requestDeviceUploadUrl } from '@/api/devices';

import { OptionalGroup, TextArea } from '../primitives';
import { ImeiDupWarning } from '../ImeiDupWarning';
import DefectChecklist from '../DefectChecklist';
import SpecsForm from '../SpecsForm';
import { conditionFromDefects, type FormValues } from '../types';

interface Props {
  control: Control<FormValues>;
  register: UseFormRegister<FormValues>;
  values: FormValues;
  setValue: (name: 'condition', v: FormValues['condition']) => void;
  errors: FieldErrors<FormValues>;
  devicePhotos: string[];
  onDevicePhotosChange: (next: string[]) => void;
}

export default function DeviceFields({
  control, register, values, setValue, errors,
  devicePhotos, onDevicePhotosChange,
}: Props) {
  const { t } = useTranslation();
  // Specs/заметки — опциональны, под общим сворачиваемым блоком. Раскрыты, если
  // уже есть данные (например пришло из «Повторить последнюю»).
  const hasSpecs = Object.keys(values.specs ?? {}).length > 0;

  return (
    <div className="card p-5 md:p-6 flex flex-col gap-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Input
              label={t('purchase.imei_label')}
              placeholder={t('purchase.imei_placeholder')}
              hint={t('purchase.imei_hint')}
              error={errors.imei?.message}
              inputMode="numeric"
              autoComplete="off"
              {...register('imei')}
            />
            <ImeiDupWarning imei={values.imei} />
          </div>
          <Input
            label={t('purchase.serial_label')}
            placeholder={t('purchase.serial_placeholder')}
            error={errors.serial?.message}
            autoComplete="off"
            {...register('serial')}
          />
        </div>

        <Controller
          control={control}
          name="defects"
          render={({ field }) => (
            <DefectChecklist
              value={field.value}
              onChange={(next) => {
                field.onChange(next);
                // Keep ``condition`` in lock-step so the submitted payload reflects the checklist.
                setValue('condition', conditionFromDefects(next));
              }}
            />
          )}
        />

        <OptionalGroup title={t('purchase.specs_section')} defaultOpen={hasSpecs}>
          <Controller
            control={control}
            name="specs"
            render={({ field }) => (
              <SpecsForm
                category={values.category}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </OptionalGroup>

        <DocumentUploader
          label={t('purchase.device_photos_label')}
          value={devicePhotos}
          onChange={onDevicePhotosChange}
          requestUploadUrl={requestDeviceUploadUrl}
          max={4}
          accept="image/*"
        />

        <OptionalGroup
          title={t('purchase.device_notes_label')}
          defaultOpen={!!values.device_notes}
        >
          <TextArea
            placeholder={t('purchase.device_notes_placeholder')}
            rows={2}
            {...register('device_notes')}
          />
        </OptionalGroup>
      </div>
  );
}
