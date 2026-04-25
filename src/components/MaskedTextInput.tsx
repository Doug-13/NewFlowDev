import { Input } from 'antd'

type MaskType = 'cpf' | 'cnpj' | 'cpf_cnpj' | 'phone' | 'cep' | undefined | null

interface Props {
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, '')
}

function applyCpfMask(value: string) {
  const v = onlyDigits(value).slice(0, 11)

  if (v.length <= 3) return v
  if (v.length <= 6) return `${v.slice(0, 3)}.${v.slice(3)}`
  if (v.length <= 9) return `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6)}`
  return `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6, 9)}-${v.slice(9, 11)}`
}

function applyCnpjMask(value: string) {
  const v = onlyDigits(value).slice(0, 14)

  if (v.length <= 2) return v
  if (v.length <= 5) return `${v.slice(0, 2)}.${v.slice(2)}`
  if (v.length <= 8) return `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5)}`
  if (v.length <= 12) return `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5, 8)}/${v.slice(8)}`
  return `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5, 8)}/${v.slice(8, 12)}-${v.slice(12, 14)}`
}

function applyCepMask(value: string) {
  const v = onlyDigits(value).slice(0, 8)

  if (v.length <= 5) return v
  return `${v.slice(0, 5)}-${v.slice(5, 8)}`
}

function applyPhoneMask(value: string) {
  const v = onlyDigits(value).slice(0, 11)

  if (v.length <= 2) return v
  if (v.length <= 6) return `(${v.slice(0, 2)}) ${v.slice(2)}`
  if (v.length <= 10) return `(${v.slice(0, 2)}) ${v.slice(2, 6)}-${v.slice(6)}`
  return `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7, 11)}`
}

function applyCpfOrCnpjMask(value: string) {
  const digits = onlyDigits(value)
  return digits.length <= 11 ? applyCpfMask(digits) : applyCnpjMask(digits)
}

function formatValue(value: string, maskType: MaskType) {
  if (!maskType) return value

  switch (maskType) {
    case 'cpf':
      return applyCpfMask(value)
    case 'cnpj':
      return applyCnpjMask(value)
    case 'cpf_cnpj':
      return applyCpfOrCnpjMask(value)
    case 'phone':
      return applyPhoneMask(value)
    case 'cep':
      return applyCepMask(value)
    default:
      return value
  }
}

export function MaskedTextInput({ value, onChange, placeholder }: Props & { maskType?: MaskType }) {
  const maskType = (arguments[0] as Props & { maskType?: MaskType }).maskType

  return (
    <Input
      value={value}
      placeholder={placeholder}
      onChange={(e) => {
        const formatted = formatValue(e.target.value, maskType)
        onChange?.(formatted)
      }}
    />
  )
}