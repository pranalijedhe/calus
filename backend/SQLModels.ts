import { Table, Column, Model, DataType, PrimaryKey, Unique, AutoIncrement } from "sequelize-typescript";

@Table({ tableName: "users", timestamps: false })
export class User extends Model {
  @PrimaryKey
  @Column(DataType.STRING)
  id!: string;

  @Unique
  @Column(DataType.STRING)
  email!: string;

  @Column(DataType.TEXT)
  password_hash!: string;

  @Column(DataType.STRING)
  role!: string;

  @Column(DataType.STRING)
  created_at!: string;
}

@Table({ tableName: "aws_pricing" })
export class AWSPricing extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  id!: number;

  @Unique
  @Column(DataType.STRING)
  sku!: string;

  @Column(DataType.STRING)
  service_code!: string;

  @Column(DataType.STRING)
  location!: string;

  @Column(DataType.STRING)
  instance_type!: string;

  @Column(DataType.STRING)
  vcpu!: string;

  @Column(DataType.STRING)
  memory!: string;

  @Column(DataType.STRING)
  operating_system!: string;

  @Column(DataType.STRING)
  tenancy!: string;

  @Column(DataType.STRING)
  usage_type!: string;

  @Column(DataType.FLOAT)
  price_per_unit!: number;

  @Column(DataType.STRING)
  unit!: string;

  @Column(DataType.JSON)
  attributes!: any;
}
