import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Form,
  Input,
  Button,
  Card,
  Typography,
  Alert,
  Divider,
  Grid,
  Space,
} from 'antd'
import {
  MailOutlined,
  LockOutlined,
  FileTextOutlined,
  SafetyCertificateOutlined,
  CheckCircleOutlined,
  TeamOutlined,
  ApartmentOutlined,
  AuditOutlined,
} from '@ant-design/icons'
import { useAuthStore } from '../../store/authStore'
import { login } from '../../api/auth'
import './LoginPage.css'

const { Title, Text } = Typography
const { useBreakpoint } = Grid

export function LoginPage() {
  const navigate = useNavigate()
  const screens = useBreakpoint()
  const setAuth = useAuthStore((s) => s.setAuth)

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const isMobile = !screens.lg

  const onFinish = async (values: { email: string; password: string }) => {
    setLoading(true)
    setError('')

    try {
      const data = await login(values.email, values.password)

      // ─── LOG PARA POSTMAN ─────────────────────────────────────────────────
      console.log('╔══════════════════════════════════════════════════════')
      console.log('║ TOKEN PARA POSTMAN')
      console.log('╠══════════════════════════════════════════════════════')
      console.log('║ Bearer', data.accessToken)
      console.log('╠══════════════════════════════════════════════════════')
      console.log('║ Usuário:', data.user?.name, '|', data.user?.role)
      console.log('║ accountId:', data.user?.accountId)
      console.log('╚══════════════════════════════════════════════════════')
      // ─────────────────────────────────────────────────────────────────────

      setAuth({
        user: data.user,
        platformAdmin: data.platformAdmin,
        token: data.accessToken,
        enabledModules: data.enabledModules,
      })

      if (data.platformAdmin) {
        navigate('/platform')
      } else {
        navigate('/')
      }
    } catch {
      setError('Email ou senha inválidos.')
    } finally {
      setLoading(false)
    }
  }

  const featureCards = [
    {
      icon: <AuditOutlined />,
      title: 'Rastreabilidade total',
      text: 'Histórico de revisões, auditoria e controle do ciclo de vida documental.',
    },
    {
      icon: <ApartmentOutlined />,
      title: 'Multiempresa e multiunidade',
      text: 'Estrutura preparada para organizações, unidades, áreas e funções.',
    },
    {
      icon: <TeamOutlined />,
      title: 'Fluxos e responsabilidades',
      text: 'Distribuição clara de responsáveis, prazos e etapas por processo.',
    },
    {
      icon: <SafetyCertificateOutlined />,
      title: 'Governança e segurança',
      text: 'Permissões, segregação de acesso e operação centralizada.',
    },
  ]

  const demoUsers = [
    { label: 'Plataforma', value: 'admin@plataforma.local' },
    { label: 'Demo Admin', value: 'admin@demo.local' },
    { label: 'Demo Gestor', value: 'gestor@demo.local' },
  ]

  return (
    <div className="login-page">
      <div className="login-page__radial" />
      <div className="login-page__blur login-page__blur--top" />
      <div className="login-page__blur login-page__blur--bottom" />

      <div className="login-page__content">
        <div
          className="login-page__grid"
          style={{
            gridTemplateColumns: isMobile ? '1fr' : '1.05fr 0.95fr',
          }}
        >
          <section className="login-page__left">
            <div>
              <div className="login-brand-pill">
                <div className="login-brand-pill__icon">
                  <FileTextOutlined />
                </div>

                <div>
                  <div className="login-brand-pill__title">Gestão de Documentos</div>
                  <div className="login-brand-pill__subtitle">
                    Plataforma corporativa unificada
                  </div>
                </div>
              </div>

              <Title className="login-hero-title">
                Controle documental com padrão corporativo e experiência premium.
              </Title>

              <Text className="login-hero-text">
                Centralize documentos, fluxos, aprovações, revisões e governança em
                um ambiente seguro, escalável e preparado para múltiplas
                organizações e perfis de acesso.
              </Text>

              <div
                className="login-feature-grid"
                style={{
                  gridTemplateColumns: isMobile
                    ? '1fr'
                    : 'repeat(2, minmax(0, 1fr))',
                }}
              >
                {featureCards.map((item) => (
                  <div key={item.title} className="login-feature-card">
                    <div className="login-feature-card__icon">{item.icon}</div>
                    <div className="login-feature-card__title">{item.title}</div>
                    <div className="login-feature-card__text">{item.text}</div>
                  </div>
                ))}
              </div>
            </div>

            {!isMobile && (
              <div className="login-stats">
                <div className="login-stat">
                  <div className="login-stat__value">24/7</div>
                  <div className="login-stat__label">Disponibilidade operacional</div>
                </div>

                <div className="login-stat">
                  <div className="login-stat__value">100%</div>
                  <div className="login-stat__label">
                    Foco em governança documental
                  </div>
                </div>

                <div className="login-stat">
                  <div className="login-stat__value">Multi-tenant</div>
                  <div className="login-stat__label">
                    Administração central e por cliente
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className="login-page__right">
            <Card
              bordered={false}
              className="login-card"
              styles={{
                body: { padding: 0 },
              }}
            >
              <div className="login-card__header">
                <div className="login-card__header-icon">
                  <SafetyCertificateOutlined />
                </div>

                <Title level={3} className="login-card__title">
                  Acessar plataforma
                </Title>

                <Text className="login-card__subtitle">
                  Entre com suas credenciais para acessar o portal da organização
                  ou o console administrativo da plataforma.
                </Text>
              </div>

              <div className="login-card__body">
                {error && (
                  <Alert
                    message={error}
                    type="error"
                    showIcon
                    className="login-card__alert"
                  />
                )}

                <Form layout="vertical" onFinish={onFinish} size="large">
                  <Form.Item
                    label={<span className="login-form__label">Email</span>}
                    name="email"
                    rules={[
                      {
                        required: true,
                        type: 'email',
                        message: 'Informe um email válido',
                      },
                    ]}
                    className="login-form__item"
                  >
                    <Input
                      autoComplete="email"
                      placeholder="seuemail@empresa.com"
                      prefix={<MailOutlined className="login-form__prefix" />}
                      className="login-form__input"
                    />
                  </Form.Item>

                  <Form.Item
                    label={<span className="login-form__label">Senha</span>}
                    name="password"
                    rules={[
                      {
                        required: true,
                        message: 'Informe sua senha',
                      },
                    ]}
                    className="login-form__item login-form__item--password"
                  >
                    <Input.Password
                      autoComplete="current-password"
                      placeholder="Digite sua senha"
                      prefix={<LockOutlined className="login-form__prefix" />}
                      className="login-form__input"
                    />
                  </Form.Item>

                  <div className="login-form__meta">
                    <Text className="login-form__meta-text">
                      Acesso seguro e unificado
                    </Text>

                    <Text className="login-form__support-link">
                      Suporte de acesso
                    </Text>
                  </div>

                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={loading}
                    block
                    className="login-form__button"
                  >
                    Entrar na plataforma
                  </Button>
                </Form>

                <Divider className="login-card__divider" />

                <div className="login-demo">
                  <Space
                    align="start"
                    size={10}
                    className="login-demo__header"
                  >
                    <div className="login-demo__icon">
                      <CheckCircleOutlined />
                    </div>

                    <div>
                      <div className="login-demo__title">
                        Credenciais de demonstração
                      </div>
                      <div className="login-demo__subtitle">
                        Utilize os acessos abaixo para testar os diferentes perfis
                        do sistema.
                      </div>
                    </div>
                  </Space>

                  <div className="login-demo__list">
                    {demoUsers.map((item) => (
                      <div key={item.label} className="login-demo__item">
                        <Text className="login-demo__item-label">{item.label}</Text>
                        <Text className="login-demo__item-value">{item.value}</Text>
                      </div>
                    ))}
                  </div>

                  <div className="login-demo__password">
                    <strong>Senha padrão:</strong> Admin@123
                  </div>
                </div>
              </div>
            </Card>
          </section>
        </div>
      </div>
    </div>
  )
}