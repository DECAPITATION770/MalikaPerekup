import { useTranslation } from 'react-i18next';
import { Controller, type Control, type UseFormRegister, type UseFormSetValue, type FieldErrors } from 'react-hook-form';

import CurrencyDualInput from '@/components/CurrencyDualInput';
import { fmtMoneyInput, moneyToNumber } from '@/lib/money';

import { OptionalGroup, TextArea } from '../primitives';
import PriceHint from '../PriceHint';
import DateChips from '../DateChips';
import { type FormValues } from '../types';
import type { Currency } from '@/api/purchases';
import type { ExchangeRateHint } from '@/api/reports';

interface Props {
  control: Control<FormValues>;
  register: UseFormRegister<FormValues>;
  setValue: UseFormSetValue<FormValues>;
  values: FormValues;
  errors: FieldErrors<FormValues>;
  rateHints?: ExchangeRateHint;
  priceResetKey: number;
}

export default function PriceFields({
  control, register, setValue, values, errors, rateHints, priceResetKey,
}: Props) {
  const { t } = useTranslation();

  const priceNum = moneyToNumber(values.price);
  const rateNum = moneyToNumber(values.exchange_rate);
  const currentUzs = values.currency === 'UZS'
    ? priceNum
    : priceNum > 0 && rateNum > 0 ? priceNum * rateNum : 0;

  return (
    <div className="card p-5 md:p-6 flex flex-col gap-4">
      <CurrencyDualInput
          key={priceResetKey}
          label={t('purchase.price_label')}
          required
          rateHints={rateHints}
          defaultCurrency={values.currency as Currency}
          defaultPrice={values.price}
          defaultRate={values.exchange_rate}
          priceError={errors.price?.message}
          rateError={errors.exchange_rate?.message}
          onChange={({ currency: curr, price: p, rate }) => {
            setValue('currency', curr as Currency, { shouldValidate: true });
            setValue('price', fmtMoneyInput(p), { shouldValidate: true });
            setValue('exchange_rate', rate ? fmtMoneyInput(rate) : '', { shouldValidate: true });
          }}
        />

        <PriceHint
          brand={values.brand}
          model={values.model}
          currentUzs={currentUzs}
        />

        <Controller
          control={control}
          name="purchase_date"
          render={({ field }) => (
            <DateChips value={field.value} onChange={field.onChange} />
          )}
        />

        <OptionalGroup title={t('purchase.comment_label')} defaultOpen={!!values.comment}>
          <TextArea
            placeholder={t('purchase.comment_placeholder')}
            rows={2}
            {...register('comment')}
          />
        </OptionalGroup>
    </div>
  );
}
