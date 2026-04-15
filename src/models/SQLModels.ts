import { Table, Column, Model, DataType, PrimaryKey, AutoIncrement, Unique } from "sequelize-typescript";

@Table({ tableName: "users" })
export class User extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  id!: number;

  @Unique
  @Column(DataType.STRING)
  email!: string;

  @Column(DataType.STRING)
  full_name!: string;

  @Column(DataType.STRING)
  hashed_password!: string;

  @Column(DataType.STRING)
  role!: string;
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
